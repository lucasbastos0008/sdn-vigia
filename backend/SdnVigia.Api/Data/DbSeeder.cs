using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Models;

namespace SdnVigia.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(SdnVigiaDbContext context)
    {
        var hasAgents = await context.Agents.AnyAsync();

        if (!hasAgents)
        {

            var agents = new List<Agent>
        {
            new()
            {
                Login = "dante",
                Name = "Dante Verissimo",
                Foto = "assets/dante-verissimo.png",
                Especialidade = "Drenar poder",
                HpMax = 123,
                HpCurrent = 123,
                Combate = 0,
                Mobilidade = 3,
                Vigor = 5,
                Intelecto = 0,
                Carisma = 5,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Enganação",
                    "Intimidação",
                    "Percepção",
                    "Persuasão",
                    "Furtividade"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "lucas",
                Name = "Lucas Kobayashi",
                Foto = "assets/lucas-kobayashi.png",
                Especialidade = "Motoqueiro fantasma",
                HpMax = 136,
                HpCurrent = 136,
                Combate = -1,
                Mobilidade = 2,
                Vigor = 2,
                Intelecto = 0,
                Carisma = 5,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Acrobacia",
                    "Atletismo",
                    "Intimidação",
                    "Performance"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "samuel",
                Name = "Samuel Rocha",
                Foto = "assets/samuel-rocha.png",
                Especialidade = "Materialização de luz",
                HpMax = 118,
                HpCurrent = 118,
                Combate = 2,
                Mobilidade = 3,
                Vigor = 1,
                Intelecto = 0,
                Carisma = 1,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Enganação",
                    "Intimidação",
                    "Percepção",
                    "Furtividade"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "helena",
                Name = "Helena Lima",
                Foto = "assets/helena-lima.png",
                Especialidade = "Artista marcial",
                HpMax = 113,
                HpCurrent = 113,
                Combate = 1,
                Mobilidade = 4,
                Vigor = 4,
                Intelecto = 0,
                Carisma = 2,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Acrobacia",
                    "Atletismo",
                    "Medicina",
                    "Performance"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "victor",
                Name = "Victor Bergmann",
                Foto = "assets/victor-bergmann.png",
                Especialidade = "Telecinese",
                HpMax = 121,
                HpCurrent = 121,
                Combate = -1,
                Mobilidade = -1,
                Vigor = 3,
                Intelecto = 5,
                Carisma = 5,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Arcana",
                    "Enganação",
                    "História",
                    "Investigação",
                    "Percepção",
                    "Persuasão"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "damadeprata",
                Name = "Dama de Prata",
                Foto = "assets/dama-de-prata.png",
                Especialidade = "Transmutação em mercúrio",
                HpMax = 165,
                HpCurrent = 165,
                Combate = 3,
                Mobilidade = 6,
                Vigor = 3,
                Intelecto = 1,
                Carisma = 3,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Acrobacia",
                    "Furtividade",
                    "Percepção"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "sara",
                Name = "Sara",
                Foto = "assets/sara.png",
                Especialidade = "Sorte (tipo Domino, da Marvel)",
                HpMax = 104,
                HpCurrent = 104,
                Combate = 0,
                Mobilidade = 5,
                Vigor = 3,
                Intelecto = 1,
                Carisma = 4,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "História",
                    "Intuição",
                    "Natureza",
                    "Percepção",
                    "Sobrevivência"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "forjaceu",
                Name = "Forja-Céu",
                Foto = "assets/forja-ceu.png",
                Especialidade = "Super resistência e força",
                HpMax = 210,
                HpCurrent = 210,
                Combate = 7,
                Mobilidade = 0,
                Vigor = 6,
                Intelecto = 2,
                Carisma = 1,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Atletismo",
                    "Intuição"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "filon",
                Name = "Fílon",
                Foto = "assets/filon.png",
                Especialidade = "Controle de fios",
                HpMax = 150,
                HpCurrent = 150,
                Combate = 1,
                Mobilidade = 4,
                Vigor = 3,
                Intelecto = 5,
                Carisma = 4,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Acrobacia",
                    "Investigação",
                    "Percepção",
                    "Prestidigitação"
                }),
                DispatchStatus = "disponivel"
            },

            new()
            {
                Login = "polux",
                Name = "Pólux",
                Foto = "assets/pólux.png",
                Especialidade = "Controle de energia radioativa",
                HpMax = 185,
                HpCurrent = 185,
                Combate = 5,
                Mobilidade = 2,
                Vigor = 1,
                Intelecto = 5,
                Carisma = 3,
                PericiasJson = JsonSerializer.Serialize(new[]
                {
                    "Arcana",
                    "Intuição",
                    "Prestidigitação"
                }),
                DispatchStatus = "disponivel"
            }
        };

            await context.Agents.AddRangeAsync(agents);
            await context.SaveChangesAsync();
        }

        var hasUsers = await context.Users.AnyAsync();

        if (!hasUsers)
        {
            var users = new List<User>
    {
        new()
        {
            Username = "dispatcher",
            PasswordHash = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes("vigia")
                )
            ),
            Role = "dispatcher"
        },

        new()
        {
            Username = "mestre",
            PasswordHash = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes("nexus")
                )
            ),
            Role = "master"
        }
    };

            await context.Users.AddRangeAsync(users);
            await context.SaveChangesAsync();
        }
    }
}