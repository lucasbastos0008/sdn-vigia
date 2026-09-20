using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SdnVigia.Api.Services;

namespace SdnVigia.Api.Authorization;

public class RequireAuthenticationAttribute : Attribute, IAsyncAuthorizationFilter
{
    public Task OnAuthorizationAsync(
        AuthorizationFilterContext context)
    {
        if (!AuthorizationService.IsAuthenticated(context.HttpContext))
        {
            context.Result = new UnauthorizedObjectResult(
                "Autenticação necessária."
            );
        }

        return Task.CompletedTask;
    }
}