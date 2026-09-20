using System.Reflection;

namespace SdnVigia.Api.Models;

public class Operation
{
    public int Id { get; set; }

    public string Name { get; set; } = "OPERAÇÃO VIGIA";

    public string Status { get; set; } = "preparacao";

    public DateTime? StartedAt { get; set; }

    public DateTime? FinishedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Mission> Missions { get; set; }
        = new List<Mission>();
}