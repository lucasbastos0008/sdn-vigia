using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Data;
using SdnVigia.Api.Models;
using SdnVigia.Api.DTOs;
using SdnVigia.Api.Authorization;

namespace SdnVigia.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MissionsController : ControllerBase
{
    private readonly SdnVigiaDbContext _context;

    public MissionsController(SdnVigiaDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequireAuthentication]
    public async Task<ActionResult<IEnumerable<Mission>>> GetMissions()
    {
        var missions = await _context.Missions
            .AsNoTracking()
            .OrderBy(mission => mission.DelayMinutes)
            .ThenBy(mission => mission.Id)
            .ToListAsync();

        return Ok(missions);
    }

    [HttpGet("{id:int}")]
    [RequireAuthentication]
    public async Task<ActionResult<Mission>> GetMission(int id)
    {
        var mission = await _context.Missions
            .AsNoTracking()
            .FirstOrDefaultAsync(mission => mission.Id == id);

        if (mission == null)
        {
            return NotFound();
        }

        return Ok(mission);
    }

    [HttpPost]
    [RequireRole("master")]
    public async Task<ActionResult<Mission>> CreateMission(
    [FromBody] Mission mission)
    {
        if (mission.OperationId <= 0)
        {
            return BadRequest("A missão precisa estar vinculada a uma operação.");
        }

        var operationExists = await _context.Operations
            .AnyAsync(operation => operation.Id == mission.OperationId);

        if (!operationExists)
        {
            return BadRequest("A operação informada não existe.");
        }

        if (mission.DelayMinutes < 0)
        {
            return BadRequest("O tempo de liberação não pode ser negativo.");
        }

        mission.Id = 0;

        mission.CreatedAt = DateTime.UtcNow;

        mission.ReleasedAt = null;
        mission.DispatchedAt = null;
        mission.CompletedAt = null;

        mission.Status = "preparada";
        mission.Stage = "fila";

        _context.Missions.Add(mission);

        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetMission),
            new { id = mission.Id },
            mission
        );
    }

    [HttpDelete("{id:int}")]
    [RequireRole("master")]
    public async Task<IActionResult> DeleteMission(int id)
    {
        var mission = await _context.Missions
            .FirstOrDefaultAsync(mission => mission.Id == id);

        if (mission == null)
        {
            return NotFound();
        }

        _context.Missions.Remove(mission);

        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("available/{operationId:int}")]
    [RequireAuthentication]
    public async Task<ActionResult<IEnumerable<Mission>>> GetAvailableMissions(
    int operationId)
    {
        var operation = await _context.Operations
            .AsNoTracking()
            .FirstOrDefaultAsync(operation => operation.Id == operationId);

        if (operation == null)
            return NotFound("Operação não encontrada.");

        if (operation.Status != "em_andamento" ||
            operation.StartedAt == null)
        {
            return Ok(Array.Empty<Mission>());
        }

        var now = DateTime.UtcNow;

        var elapsedMinutes =
            (now - operation.StartedAt.Value).TotalMinutes;

        // Libera tudo cujo DelayMinutes já venceu.
        var missionsToRelease = await _context.Missions
            .Where(mission =>
                mission.OperationId == operationId &&
                mission.ReleasedAt == null &&
                mission.DelayMinutes <= elapsedMinutes)
            .ToListAsync();

        foreach (var mission in missionsToRelease)
        {
            mission.ReleasedAt = now;

            // Só altera o estado se ainda estiver aguardando.
            if (mission.Status == "preparada")
            {
                mission.Status = "liberada";
                mission.Stage = "fila";
            }
        }

        if (missionsToRelease.Count > 0)
        {
            await _context.SaveChangesAsync();
        }

        /*
         * IMPORTANTE:
         * retorna todas as missões já liberadas da operação,
         * e não apenas as que ainda estão na fila.
         *
         * Assim um F5 consegue reconstruir o Dispatcher.
         */
        var visibleMissions = await _context.Missions
            .Include(mission => mission.MissionAgents)
            .ThenInclude(assignment => assignment.Agent)
            .AsNoTracking()
            .Where(mission =>
                mission.OperationId == operationId &&
                mission.ReleasedAt != null &&
                mission.Status != "concluida")
            .OrderBy(mission => mission.DelayMinutes)
            .ThenBy(mission => mission.Id)
            .ToListAsync();

        return Ok(visibleMissions);
    }

    [HttpPost("release/{operationId:int}")]
    [RequireRole("master")]
    public async Task<ActionResult<IEnumerable<Mission>>> ReleaseMissions(
    int operationId)
    {
        var operation = await _context.Operations
            .FirstOrDefaultAsync(operation => operation.Id == operationId);

        if (operation == null)
        {
            return NotFound("Operação não encontrada.");
        }

        if (operation.Status != "em_andamento" || operation.StartedAt == null)
        {
            return BadRequest("A operação não está em andamento.");
        }

        var elapsedMinutes =
            (DateTime.UtcNow - operation.StartedAt.Value).TotalMinutes;

        var missions = await _context.Missions
            .Where(mission =>
                mission.OperationId == operationId &&
                mission.ReleasedAt == null &&
                mission.DelayMinutes <= elapsedMinutes)
            .OrderBy(mission => mission.DelayMinutes)
            .ThenBy(mission => mission.Id)
            .ToListAsync();

        if (missions.Count == 0)
        {
            return Ok(Array.Empty<Mission>());
        }

        var releasedAt = DateTime.UtcNow;

        foreach (var mission in missions)
        {
            mission.ReleasedAt = releasedAt;
            mission.Status = "liberada";
            mission.Stage = "fila";
        }

        await _context.SaveChangesAsync();

        return Ok(missions);
    }

    [HttpPost("{id:int}/dispatch")]
    [RequireRole("dispatcher")]
    public async Task<ActionResult<Mission>> DispatchMission(
    int id,
    [FromBody] List<int> agentIds)
    {
        var mission = await _context.Missions
            .Include(mission => mission.MissionAgents)
            .FirstOrDefaultAsync(mission => mission.Id == id);

        if (mission == null)
        {
            return NotFound("Missão não encontrada.");
        }

        if (mission.Status != "liberada" || mission.Stage != "fila")
        {
            return BadRequest("A missão não está disponível para despacho.");
        }

        if (agentIds == null || agentIds.Count == 0 || agentIds.Count != agentIds.Distinct().Count())
        {
            return BadRequest("É necessário selecionar pelo menos um agente.");
        }

        if (mission.MaxSlots.HasValue &&
            agentIds.Count > mission.MaxSlots.Value)
        {
            return BadRequest("A missão excede o número máximo de agentes.");
        }

        var agents = await _context.Agents
            .Where(agent => agentIds.Contains(agent.Id))
            .ToListAsync();

        if (agents.Count != agentIds.Distinct().Count())
            return BadRequest("Um ou mais agentes não foram encontrados.");

        var now = DateTime.UtcNow;

        // Corrige automaticamente descansos que já terminaram.
        foreach (var agent in agents)
        {
            if (agent.DispatchStatus == "descansando" &&
                agent.RestUntil.HasValue &&
                agent.RestUntil.Value <= now)
            {
                agent.DispatchStatus = "disponivel";
                agent.RestUntil = null;
                agent.UpdatedAt = now;
            }
        }

        var unavailableAgents = agents
            .Where(agent => agent.DispatchStatus != "disponivel")
            .ToList();

        if (unavailableAgents.Count > 0)
        {
            return BadRequest(
                "Um ou mais agentes já estão em missão ou descansando."
            );
        }

        foreach (var agent in agents)
        {
            mission.MissionAgents.Add(new MissionAgent
            {
                MissionId = mission.Id,
                AgentId = agent.Id,
                AssignedAt = DateTime.UtcNow
            });

            agent.DispatchStatus = "ocupado";
            agent.RestUntil = null;
            agent.UpdatedAt = DateTime.UtcNow;
        }

        mission.Status = "despachada";
        mission.Stage = "em_andamento";
        mission.DispatchedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(mission);
    }

    [HttpPost("{id:int}/complete")]
    [RequireRole("dispatcher")]
    public async Task<ActionResult<Mission>> CompleteMission(
    int id,
    [FromBody] CompleteMissionRequest request)
    {
        var mission = await _context.Missions
            .Include(mission => mission.MissionAgents)
            .ThenInclude(missionAgent => missionAgent.Agent)
            .FirstOrDefaultAsync(mission => mission.Id == id);

        if (mission == null)
        {
            return NotFound("Missão não encontrada.");
        }

        if (mission.Status != "despachada" ||
            mission.Stage != "em_andamento")
        {
            return BadRequest("A missão não está em andamento.");
        }

        if (string.IsNullOrWhiteSpace(request.Outcome))
        {
            return BadRequest("O resultado da missão é obrigatório.");
        }

        var completedAt = DateTime.UtcNow;

        var result = new MissionResult
        {
            MissionId = mission.Id,
            Outcome = request.Outcome,
            ChosenOption = request.ChosenOption,
            Chance = request.Chance,
            Roll = request.Roll,
            Summary = request.Summary,
            CreatedAt = completedAt
        };

        _context.MissionResults.Add(result);

        foreach (var missionAgent in mission.MissionAgents)
        {
            missionAgent.Agent.DispatchStatus = "descansando";
            missionAgent.Agent.RestUntil =
                completedAt.AddMinutes(2);
            missionAgent.Agent.UpdatedAt = completedAt;
        }

        mission.Status = "concluida";
        mission.Stage = "finalizada";
        mission.CompletedAt = completedAt;

        await _context.SaveChangesAsync();

        return Ok(mission);
    }
}