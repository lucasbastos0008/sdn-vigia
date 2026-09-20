using SdnVigia.Api.Models;

namespace SdnVigia.Api.Services;

public static class AuthorizationService
{
    public static User? GetUser(HttpContext context)
    {
        return context.Items["User"] as User;
    }

    public static Agent? GetAgent(HttpContext context)
    {
        return context.Items["Agent"] as Agent;
    }

    public static bool IsAuthenticated(HttpContext context)
    {
        return GetUser(context) != null ||
               GetAgent(context) != null;
    }

    public static bool HasRole(
        HttpContext context,
        string role)
    {
        var user = GetUser(context);

        if (user != null)
        {
            return user.Role.Equals(
                role,
                StringComparison.OrdinalIgnoreCase
            );
        }

        var agent = GetAgent(context);

        if (agent != null)
        {
            return role.Equals(
                "player",
                StringComparison.OrdinalIgnoreCase
            );
        }

        return false;
    }
}