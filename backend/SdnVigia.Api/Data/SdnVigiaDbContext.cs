using Microsoft.EntityFrameworkCore;
using SdnVigia.Api.Models;
using static System.Collections.Specialized.BitVector32;

namespace SdnVigia.Api.Data;

public class SdnVigiaDbContext : DbContext
{
    public SdnVigiaDbContext(
        DbContextOptions<SdnVigiaDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Session> Sessions => Set<Session>();

    public DbSet<Agent> Agents => Set<Agent>();

    public DbSet<Operation> Operations => Set<Operation>();

    public DbSet<Mission> Missions => Set<Mission>();

    public DbSet<MissionAgent> MissionAgents => Set<MissionAgent>();

    public DbSet<RadioMessage> RadioMessages => Set<RadioMessage>();

    public DbSet<MissionResult> MissionResults => Set<MissionResult>();

    protected override void OnModelCreating(
        ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(x => x.Username)
            .IsUnique();

        modelBuilder.Entity<Session>()
            .HasIndex(x => x.Token)
            .IsUnique();

        modelBuilder.Entity<Agent>()
            .HasIndex(x => x.Login)
            .IsUnique();

        modelBuilder.Entity<Session>()
            .HasOne(x => x.Agent)
            .WithMany()
            .HasForeignKey(x => x.AgentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MissionAgent>()
            .HasKey(x => new
            {
                x.MissionId,
                x.AgentId
            });

        modelBuilder.Entity<MissionAgent>()
            .HasOne(x => x.Mission)
            .WithMany(x => x.MissionAgents)
            .HasForeignKey(x => x.MissionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MissionAgent>()
            .HasOne(x => x.Agent)
            .WithMany()
            .HasForeignKey(x => x.AgentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Mission>()
            .HasOne(x => x.Operation)
            .WithMany(x => x.Missions)
            .HasForeignKey(x => x.OperationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RadioMessage>()
            .HasOne(x => x.Mission)
            .WithMany()
            .HasForeignKey(x => x.MissionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RadioMessage>()
            .HasOne(x => x.Agent)
            .WithMany()
            .HasForeignKey(x => x.AgentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<MissionResult>()
            .HasOne(x => x.Mission)
            .WithMany()
            .HasForeignKey(x => x.MissionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}