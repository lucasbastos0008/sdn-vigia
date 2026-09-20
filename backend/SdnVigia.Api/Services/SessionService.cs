using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Data;
using SdnVigia.Api.Models;

namespace SdnVigia.Api.Services;

public class SessionService
{
    private readonly SdnVigiaDbContext _context;

    public SessionService(SdnVigiaDbContext context)
    {
        _context = context;
    }

    public async Task<Session?> GetValidSessionAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var session = await _context.Sessions
            .Include(session => session.User)
            .Include(session => session.Agent)
            .FirstOrDefaultAsync(session => session.Token == token);

        if (session == null)
        {
            return null;
        }

        if (session.ExpiresAt <= DateTime.UtcNow)
        {
            return null;
        }

        return session;
    }
}