namespace SdnVigia.Api.Models;

public class Session
{
    public int Id { get; set; }

    public int? UserId { get; set; }
    public User? User { get; set; }

    public int? AgentId { get; set; }
    public Agent? Agent { get; set; }

    public string Token { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}