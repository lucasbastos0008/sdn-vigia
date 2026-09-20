using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Authorization;
using SdnVigia.Api.Data;
using SdnVigia.Api.Models;

namespace SdnVigia.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AgentsController : ControllerBase
{
    private readonly SdnVigiaDbContext _context;

    public AgentsController(SdnVigiaDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequireAuthentication]
    public async Task<ActionResult<IEnumerable<Agent>>> GetAgents()
    {
        var agents = await _context.Agents
            .AsNoTracking()
            .OrderBy(agent => agent.Name)
            .ToListAsync();

        return Ok(agents);
    }

    // Presence comes from server sessions, shared by every computer.
    [HttpGet("presence")]
    [RequireAuthentication]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetPresence()
    {
        var now = DateTime.UtcNow;
        var activeIds = await _context.Sessions.AsNoTracking()
            .Where(s => s.AgentId != null && s.ExpiresAt > now)
            .Select(s => s.AgentId!.Value).Distinct().ToListAsync();
        var roster = await _context.Agents.AsNoTracking().ToListAsync();
        var npcLogins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "damadeprata", "sara", "forjaceu", "filon", "polux" };
        return Ok(roster.Select(a => new {
            a.Id, a.Login,
            IsNpc = npcLogins.Contains(a.Login ?? ""),
            LoggedIn = npcLogins.Contains(a.Login ?? "") || activeIds.Contains(a.Id)
        }));
    }

    [HttpPost("update-status")]
    [RequireRole("dispatcher")]
    public async Task<ActionResult<IEnumerable<Agent>>> UpdateAgentStatuses()
    {
        var now = DateTime.UtcNow;

        var agents = await _context.Agents
            .Where(agent =>
                agent.DispatchStatus == "descansando" &&
                agent.RestUntil != null &&
                agent.RestUntil <= now)
            .ToListAsync();

        foreach (var agent in agents)
        {
            agent.DispatchStatus = "disponivel";
            agent.RestUntil = null;
            agent.UpdatedAt = now;
        }

        if (agents.Count > 0)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(agents);
    }

    [HttpPost("reset-operational-status")]
    [RequireRole("dispatcher")]
    public async Task<ActionResult<IEnumerable<Agent>>> ResetOperationalStatus()
    {
        var now = DateTime.UtcNow;

        var agents = await _context.Agents.ToListAsync();

        foreach (var agent in agents)
        {
            agent.DispatchStatus = "disponivel";
            agent.RestUntil = null;
            agent.UpdatedAt = now;
        }

        await _context.SaveChangesAsync();

        return Ok(agents);
    }

}
