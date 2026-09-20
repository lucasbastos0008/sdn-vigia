using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using SdnVigia.Api.Services;

namespace SdnVigia.Api.Authorization;

public class RequireRoleAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string _role;

    public RequireRoleAttribute(string role)
    {
        _role = role;
    }

    public Task OnAuthorizationAsync(
        AuthorizationFilterContext context)
    {
        var httpContext = context.HttpContext;

        if (!AuthorizationService.HasRole(httpContext, _role))
        {
            context.Result = new UnauthorizedObjectResult(
                "Acesso não autorizado."
            );
        }

        return Task.CompletedTask;
    }
}