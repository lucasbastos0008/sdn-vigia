namespace SdnVigia.Api.Models;

public class RadioMessage
{
    public int Id { get; set; }

    public int MissionId { get; set; }

    public Mission Mission { get; set; } = null!;

    public int? AgentId { get; set; }

    public Agent? Agent { get; set; }

    public string SenderType { get; set; } = "dispatcher";

    public string Message { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}