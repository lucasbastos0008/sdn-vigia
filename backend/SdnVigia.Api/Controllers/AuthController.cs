using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Data;
using SdnVigia.Api.DTOs;
using SdnVigia.Api.Models;
using SdnVigia.Api.Services;
using System.Security.Cryptography;
using System.Text;
using SdnVigia.Api.Authorization;

namespace SdnVigia.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly SdnVigiaDbContext _context;

    public AuthController(SdnVigiaDbContext context)
    {
        _context = context;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
        {
            return BadRequest("Usuário ou identificação são obrigatórios.");
        }

        var username = request.Username.Trim().ToLowerInvariant();

        // ==========================================
        // 1. TENTA LOGIN DE USUÁRIO ADMINISTRATIVO
        // ==========================================

        var user = await _context.Users
            .FirstOrDefaultAsync(user =>
                user.Username.ToLower() == username);

        if (user != null)
        {
            if (string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest("Senha obrigatória para este usuário.");
            }

            var passwordHash = Convert.ToHexString(
                SHA256.HashData(
                    Encoding.UTF8.GetBytes(request.Password)
                )
            );

            if (user.PasswordHash != passwordHash)
            {
                return Unauthorized("Usuário ou senha inválidos.");
            }

            var token = Convert.ToHexString(
                RandomNumberGenerator.GetBytes(32)
            );

            var expiresAt = DateTime.UtcNow.AddHours(8);

            var session = new Session
            {
                UserId = user.Id,
                AgentId = null,
                Token = token,
                CreatedAt = DateTime.UtcNow,
                LastSeenAt = DateTime.UtcNow,
                ExpiresAt = expiresAt
            };

            _context.Sessions.Add(session);

            await _context.SaveChangesAsync();

            return Ok(new LoginResponse
            {
                Token = token,
                Username = user.Username,
                Role = user.Role,
                ExpiresAt = expiresAt
            });
        }

        // ==========================================
        // 2. TENTA LOGIN DE AGENTE
        // ==========================================

        var agent = await _context.Agents
            .FirstOrDefaultAsync(agent =>
                agent.Login != null &&
                agent.Login.ToLower() == username);

        if (agent == null)
        {
            return Unauthorized(
                "Identificação não reconhecida na rede."
            );
        }

        var agentToken = Convert.ToHexString(
            RandomNumberGenerator.GetBytes(32)
        );

        var agentExpiresAt = DateTime.UtcNow.AddHours(8);

        var agentSession = new Session
        {
            UserId = null,
            AgentId = agent.Id,
            Token = agentToken,
            CreatedAt = DateTime.UtcNow,
            LastSeenAt = DateTime.UtcNow,
            ExpiresAt = agentExpiresAt
        };

        _context.Sessions.Add(agentSession);

        await _context.SaveChangesAsync();

        return Ok(new LoginResponse
        {
            Token = agentToken,
            Username = agent.Login!,
            Role = "player",
            ExpiresAt = agentExpiresAt
        });
    }

    [HttpGet("me")]
    public async Task<ActionResult<LoginResponse>> Me(
        [FromHeader(Name = "Authorization")] string? authorization)
    {
        if (string.IsNullOrWhiteSpace(authorization))
        {
            return Unauthorized("Token não informado.");
        }

        if (!authorization.StartsWith("Bearer "))
        {
            return Unauthorized("Formato de autorização inválido.");
        }

        var token = authorization["Bearer ".Length..].Trim();

        if (string.IsNullOrWhiteSpace(token))
        {
            return Unauthorized("Token não informado.");
        }

        var sessionService = HttpContext.RequestServices
            .GetRequiredService<SessionService>();

        var session = await sessionService.GetValidSessionAsync(token);

        if (session == null)
        {
            return Unauthorized("Sessão inválida ou expirada.");
        }

        session.LastSeenAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (session.User != null)
        {
            return Ok(new LoginResponse
            {
                Token = session.Token,
                Username = session.User.Username,
                Role = session.User.Role,
                ExpiresAt = session.ExpiresAt
            });
        }

        if (session.Agent != null)
        {
            return Ok(new LoginResponse
            {
                Token = session.Token,
                Username = session.Agent.Login!,
                Role = "player",
                ExpiresAt = session.ExpiresAt
            });
        }

        return Unauthorized("Sessão sem identidade válida.");
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(
        [FromHeader(Name = "Authorization")] string? authorization)
    {
        if (string.IsNullOrWhiteSpace(authorization))
        {
            return Unauthorized("Token não informado.");
        }

        if (!authorization.StartsWith("Bearer "))
        {
            return Unauthorized("Formato de autorização inválido.");
        }

        var token = authorization["Bearer ".Length..].Trim();

        if (string.IsNullOrWhiteSpace(token))
        {
            return Unauthorized("Token não informado.");
        }

        var session = await _context.Sessions
            .FirstOrDefaultAsync(session => session.Token == token);

        if (session == null)
        {
            return NotFound("Sessão não encontrada.");
        }

        _context.Sessions.Remove(session);

        await _context.SaveChangesAsync();

        return NoContent();
    }
}