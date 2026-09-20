namespace SdnVigia.Api.Models;

public class MissionResult
{
    public int Id { get; set; }

    public int MissionId { get; set; }

    public Mission Mission { get; set; } = null!;

    public string Outcome { get; set; } = string.Empty;

    public string? ChosenOption { get; set; }

    public int? Chance { get; set; }

    public int? Roll { get; set; }

    public string? Summary { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}