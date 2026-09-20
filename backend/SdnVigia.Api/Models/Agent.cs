namespace SdnVigia.Api.Models;

public class Agent
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Login { get; set; }

    public string? Foto { get; set; }

    public string Especialidade { get; set; } = string.Empty;

    public int HpMax { get; set; }

    public int HpCurrent { get; set; }

    public int Combate { get; set; }

    public int Mobilidade { get; set; }

    public int Vigor { get; set; }

    public int Intelecto { get; set; }

    public int Carisma { get; set; }

    public string PericiasJson { get; set; } = "[]";

    public string DispatchStatus { get; set; } = "disponivel";

    public DateTime? RestUntil { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}