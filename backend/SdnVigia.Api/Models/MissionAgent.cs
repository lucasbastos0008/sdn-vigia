namespace SdnVigia.Api.Models;

public class MissionAgent
{
    public int MissionId { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public Mission Mission { get; set; } = null!;

    public int AgentId { get; set; }

    public Agent Agent { get; set; } = null!;

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
}