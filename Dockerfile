FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/SdnVigia.Api/SdnVigia.Api.csproj backend/SdnVigia.Api/
RUN dotnet restore backend/SdnVigia.Api/SdnVigia.Api.csproj

COPY backend/SdnVigia.Api/ backend/SdnVigia.Api/
RUN dotnet publish backend/SdnVigia.Api/SdnVigia.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
COPY frontend ./wwwroot

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
ENTRYPOINT ["sh", "-c", "dotnet SdnVigia.Api.dll --urls http://0.0.0.0:${PORT:-10000}"]
