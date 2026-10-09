using Microsoft.EntityFrameworkCore;
using Transferencias.Domain;

namespace Transferencias.Data;

public class BankDb(DbContextOptions<BankDb> options) : DbContext(options)
{
    public DbSet<Person> People => Set<Person>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<TransferLimit> TransferLimits => Set<TransferLimit>();
    public DbSet<Transfer> Transfers => Set<Transfer>();
    public DbSet<TransferAttempt> TransferAttempts => Set<TransferAttempt>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<Person>(e =>
        {
            e.ToTable("persons");
            e.Property(p => p.Name).HasMaxLength(150).IsRequired();
            e.Property(p => p.Document).HasMaxLength(20);
            e.Property(p => p.Email).HasMaxLength(150);
            e.Property(p => p.Phone).HasMaxLength(20);
            e.Property(p => p.ZipCode).HasMaxLength(10);
            e.Property(p => p.Street).HasMaxLength(150);
            e.Property(p => p.Number).HasMaxLength(20);
            e.Property(p => p.Complement).HasMaxLength(100);
            e.Property(p => p.Neighborhood).HasMaxLength(100);
            e.Property(p => p.City).HasMaxLength(100);
            e.Property(p => p.State).HasMaxLength(2);

            e.HasIndex(p => p.Document).IsUnique();
            e.HasIndex(p => p.Email).IsUnique();

            e.HasOne(p => p.Account)
                .WithOne(a => a.Person)
                .HasForeignKey<Account>(a => a.PersonId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(p => p.Limit)
                .WithOne(l => l.Person)
                .HasForeignKey<TransferLimit>(l => l.PersonId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<Account>(e =>
        {
            e.ToTable("accounts");
            e.Property(a => a.Balance).HasPrecision(18, 2);
            e.Property(a => a.OverdraftLimit).HasPrecision(18, 2);
            e.HasIndex(a => a.PersonId).IsUnique();
        });

        model.Entity<TransferLimit>(e =>
        {
            e.ToTable("transfer_limits");
            e.Property(l => l.DayHourlyAmountLimit).HasPrecision(18, 2);
            e.Property(l => l.NightHourlyAmountLimit).HasPrecision(18, 2);
            e.HasIndex(l => l.PersonId).IsUnique();
        });

        model.Entity<Transfer>(e =>
        {
            e.ToTable("transfers");
            e.Property(t => t.Amount).HasPrecision(18, 2);
            e.Property(t => t.FailureReason).HasMaxLength(500);
            e.Property(t => t.IdempotencyKey).HasMaxLength(100);

            e.HasOne(t => t.SourceAccount).WithMany()
                .HasForeignKey(t => t.SourceAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(t => t.DestinationAccount).WithMany()
                .HasForeignKey(t => t.DestinationAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(t => t.IdempotencyKey).IsUnique().HasFilter("idempotency_key IS NOT NULL");
            e.HasIndex(t => new { t.Status, t.ScheduledAt });
            e.HasIndex(t => new { t.SourceAccountId, t.Status, t.ProcessedAt });
        });

        model.Entity<TransferAttempt>(e =>
        {
            e.ToTable("transfer_attempts");
            e.Property(a => a.Amount).HasPrecision(18, 2);
            e.Property(a => a.FailureReason).HasMaxLength(500);
            e.HasOne<Account>().WithMany()
                .HasForeignKey(a => a.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(a => new { a.AccountId, a.CreatedAt });
        });

        model.Entity<OutboxMessage>(e =>
        {
            e.ToTable("outbox_messages");
            e.Property(m => m.Topic).HasMaxLength(100).IsRequired();
            e.Property(m => m.Key).HasMaxLength(100).IsRequired();
            e.Property(m => m.Payload).IsRequired();
            e.Property(m => m.LastError).HasMaxLength(500);
            e.HasIndex(m => m.CreatedAt).HasFilter("published_at IS NULL");
        });
    }
}
