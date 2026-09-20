namespace SdnVigia.Api.DTOs;

public class CompleteMissionRequest
{
    public string Outcome { get; set; } = string.Empty;
    public string? ChosenOption { get; set; }
    public int? Chance { get; set; }
    public int? Roll { get; set; }
    public string? Summary { get; set; }
}