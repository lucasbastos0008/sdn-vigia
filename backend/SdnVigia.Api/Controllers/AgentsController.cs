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