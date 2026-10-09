using Microsoft.EntityFrameworkCore;
using Transferencias.Data;

namespace Transferencias.Features.Messaging;

public sealed class OutboxPublisherWorker(
    IServiceScopeFactory scopes,
    IMessageBus bus,
    ILogger<OutboxPublisherWorker> log) : BackgroundService
{
    private const int BatchSize = 50;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(2);

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        using var timer = new PeriodicTimer(PollInterval);

        try
        {
            do
            {
                try
                {
                    while (await PublishBatchAsync(stopping) == BatchSize)
                    {
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Falha ao publicar mensagens do outbox.");
                }
            }
            while (await timer.WaitForNextTickAsync(stopping));
        }
        catch (OperationCanceledException)
        {
        }
    }

    private async Task<int> PublishBatchAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<BankDb>();

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // A trava de linha mantém a mensagem reservada a esta instância até o commit.
        var batch = await db.OutboxMessages
            .FromSql($"""
                SELECT * FROM outbox_messages
                WHERE published_at IS NULL
                ORDER BY created_at
                LIMIT {BatchSize}
                FOR UPDATE SKIP LOCKED
                """)
            .ToListAsync(ct);

        if (batch.Count == 0)
        {
            return 0;
        }

        foreach (var message in batch)
        {
            try
            {
                await bus.PublishAsync(message.Topic, message.Key, message.Payload, ct);
                message.PublishedAt = DateTime.UtcNow;
                message.LastError = null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                message.Attempts++;
                message.LastError = ex.Message.Length > 500 ? ex.Message[..500] : ex.Message;
                log.LogWarning(ex, "Não foi possível publicar a mensagem {MessageId}; será tentada de novo.", message.Id);
            }
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return batch.Count;
    }
}
