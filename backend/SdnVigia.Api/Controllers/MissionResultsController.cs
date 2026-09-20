using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Data;
using SdnVigia.Api.Models;
using SdnVigia.Api.Authorization;

namespace SdnVigia.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MissionResultsController : ControllerBase
{
    private readonly SdnVigiaDbContext _context;

    public MissionResultsController(SdnVigiaDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequireAuthentication]

    public async Task<ActionResult<IEnumerable<MissionResult>>> GetResults()
    {
        var results = await _context.MissionResults
            .AsNoTracking()
            .OrderByDescending(result => result.CreatedAt)
            .ToListAsync();

        return Ok(results);
    }

    [HttpGet("{missionId:int}")]
    [RequireAuthentication]

    public async Task<ActionResult<MissionResult>> GetResult(int missionId)
    {
        var result = await _context.MissionResults
            .AsNoTracking()
            .FirstOrDefaultAsync(result => result.MissionId == missionId);

        if (result == null)
        {
            return NotFound("Resultado da missão não encontrado.");
        }

        return Ok(result);
    }
}