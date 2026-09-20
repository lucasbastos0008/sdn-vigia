using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Data;
using SdnVigia.Api.Models;
using SdnVigia.Api.Authorization;

namespace SdnVigia.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OperationsController : ControllerBase
{
    private readonly SdnVigiaDbContext _context;

    public OperationsController(SdnVigiaDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequireAuthentication]
    public async Task<ActionResult<IEnumerable<Operation>>> GetOperations()
    {
        var operations = await _context.Operations
            .AsNoTracking()
            .OrderByDescending(operation => operation.CreatedAt)
            .ToListAsync();

        return Ok(operations);
    }

    [HttpGet("{id:int}")]
    [RequireAuthentication]
    public async Task<ActionResult<Operation>> GetOperation(int id)
    {
        var operation = await _context.Operations
            .AsNoTracking()
            .FirstOrDefaultAsync(operation => operation.Id == id);

        if (operation == null)
        {
            return NotFound();
        }

        return Ok(operation);
    }

    [HttpPost]
    [RequireRole("master")]
    public async Task<ActionResult<Operation>> CreateOperation(Operation operation)
    {
        operation.Id = 0;
        operation.CreatedAt = DateTime.UtcNow;
        operation.Status = "preparacao";
        operation.StartedAt = null;
        operation.FinishedAt = null;

        _context.Operations.Add(operation);

        await _context.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetOperation),
            new { id = operation.Id },
            operation
        );
    }

    [HttpPost("{id:int}/start")]
    [RequireRole("master")]
    public async Task<ActionResult<Operation>> StartOperation(int id)
    {
        var operation = await _context.Operations
            .FirstOrDefaultAsync(operation => operation.Id == id);

        if (operation == null)
        {
            return NotFound();
        }

        if (operation.Status != "preparacao")
        {
            return BadRequest("A operação não está em preparação.");
        }

        operation.Status = "em_andamento";
        operation.StartedAt = DateTime.UtcNow;
        operation.FinishedAt = null;

        await _context.SaveChangesAsync();

        return Ok(operation);
    }
}