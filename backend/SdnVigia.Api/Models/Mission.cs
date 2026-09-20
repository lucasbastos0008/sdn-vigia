namespace SdnVigia.Api.Models;

public class Mission
{
    public int Id { get; set; }

    // Identificador da missão usado pelo sistema, ex.: "m01".
    public string Code { get; set; } = string.Empty;

    public int OperationId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public Operation? Operation { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string Threat { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;

    public int? MaxSlots { get; set; }

    // Minutos após o início da operação para a missão aparecer.
    public int DelayMinutes { get; set; }

    // Minutos após o despacho até a complicação.
    public int? DurationMinutes { get; set; }

    public string? ClientCallJson { get; set; }

    public string? TacticalRequirementsJson { get; set; }

    public string? RecommendedSkillsJson { get; set; }

    public string? AttributeRequirementsJson { get; set; }

    public string? CustomComplicationJson { get; set; }

    public string? Note { get; set; }

    public string Status { get; set; } = "preparada";

    public string Stage { get; set; } = "fila";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReleasedAt { get; set; }

    public DateTime? DispatchedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? ResultJson { get; set; }

    public ICollection<MissionAgent> MissionAgents { get; set; }
        = new List<MissionAgent>();
}