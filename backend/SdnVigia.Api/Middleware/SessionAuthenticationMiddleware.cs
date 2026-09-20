using SdnVigia.Api.Services;

namespace SdnVigia.Api.Middleware;

public class SessionAuthenticationMiddleware
{
    private readonly RequestDelegate _next;

    public SessionAuthenticationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(
        HttpContext context,
        SessionService sessionService)
    {
        var authorization = context.Request.Headers.Authorization.ToString();

        if (!string.IsNullOrWhiteSpace(authorization) &&
            authorization.StartsWith("Bearer "))
        {
            var token = authorization["Bearer ".Length..].Trim();

            var session = await sessionService.GetValidSessionAsync(token);

            if (session != null)
            {
                context.Items["Session"] = session;

                if (session.User != null)
                {
                    context.Items["User"] = session.User;
                }

                if (session.Agent != null)
                {
                    context.Items["Agent"] = session.Agent;
                }
            }
        }

        await _next(context);
    }
}