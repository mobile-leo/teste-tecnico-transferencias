using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Transferencias.Common;
using Transferencias.Data;
using Transferencias.Domain;
using Transferencias.Features.Messaging;

namespace Transferencias.Features.Transfers;

public record TransferInput(int SourceAccountId, int DestinationAccountId, decimal Amount);

public record ScheduleInput(int SourceAccountId, int DestinationAccountId, decimal Amount, DateTime ScheduledAt);

public record TransferView(
    Guid Id,
    int SourceAccountId,
    int DestinationAccountId,
    string? SourceAccountName,
    string? DestinationAccountName,
    decimal Amount,
    string Status,
    DateTime CreatedAt,
    DateTime? ScheduledAt,
    DateTime? ProcessedAt,
    DateTime? CancelledAt,
    string? FailureReason)
{
    public static TransferView From(Transfer t) => new(
        t.Id,
        t.SourceAccountId,
        t.DestinationAccountId,
        t.SourceAccount?.Person?.Name,
        t.DestinationAccount?.Person?.Name,
        t.Amount,
        t.Status.ToString(),
        t.CreatedAt,
        t.ScheduledAt,
        t.ProcessedAt,
        t.CancelledAt,
        t.FailureReason);
}

public class TransferDesk(BankDb db, LimitPolicy limits, ILogger<TransferDesk> log)
{
    private const decimal MaxAmount = 999_999_999_999m;

    public async Task<TransferView> TransferNowAsync(TransferInput input, string? rawKey, CancellationToken ct)
    {
        CheckBasics(input.SourceAccountId, input.DestinationAccountId, input.Amount);

        var key = CleanKey(rawKey);
        if (key is not null && await FindByKeyAsync(key, ct) is { } replay)
        {
            return TransferView.From(replay);
        }

        await EnsureAccountsExistAsync(input.SourceAccountId, input.DestinationAccountId, ct);

        var transfer = new Transfer
        {
            Id = Guid.NewGuid(),
            SourceAccountId = input.SourceAccountId,
            DestinationAccountId = input.DestinationAccountId,
            Amount = input.Amount,
            Status = TransferStatus.Processing,
            CreatedAt = DateTime.UtcNow,
            IdempotencyKey = key
        };

        if (await TrySaveNewAsync(transfer, key, ct) is { } winner)
        {
            return TransferView.From(winner);
        }

        var failure = await SettleAsync(transfer.Id, ct);
        if (failure is not null)
        {
            throw failure;
        }

        return TransferView.From(await LoadAsync(transfer.Id, ct));
    }

    public async Task<TransferView> ScheduleAsync(ScheduleInput input, string? rawKey, CancellationToken ct)
    {
        CheckBasics(input.SourceAccountId, input.DestinationAccountId, input.Amount);

        if (input.ScheduledAt.Kind == DateTimeKind.Unspecified)
        {
            throw new DomainError("A data de agendamento deve informar o fuso horário ou utilizar UTC.");
        }

        var when = input.ScheduledAt.ToUniversalTime();
        if (when <= DateTime.UtcNow)
        {
            throw new DomainError("A data do agendamento deve ser futura.");
        }

        var key = CleanKey(rawKey);
        if (key is not null && await FindByKeyAsync(key, ct) is { } replay)
        {
            return TransferView.From(replay);
        }

        var accounts = await EnsureAccountsExistAsync(input.SourceAccountId, input.DestinationAccountId, ct);
        EnsureActive(accounts[input.SourceAccountId], accounts[input.DestinationAccountId]);

        var transfer = new Transfer
        {
            Id = Guid.NewGuid(),
            SourceAccountId = input.SourceAccountId,
            DestinationAccountId = input.DestinationAccountId,
            Amount = input.Amount,
            Status = TransferStatus.Scheduled,
            CreatedAt = DateTime.UtcNow,
            ScheduledAt = when,
            IdempotencyKey = key
        };

        if (await TrySaveNewAsync(transfer, key, ct) is { } winner)
        {
            return TransferView.From(winner);
        }

        return TransferView.From(await LoadAsync(transfer.Id, ct));
    }

    public async Task<TransferView> GetAsync(Guid id, CancellationToken ct) =>
        TransferView.From(await LoadAsync(id, ct));

    public async Task<IReadOnlyList<TransferView>> HistoryAsync(int accountId, CancellationToken ct)
    {
        if (!await db.Accounts.AnyAsync(a => a.Id == accountId, ct))
        {
            throw DomainError.NotFound("Conta não encontrada.");
        }

        var rows = await WithNames(db.Transfers.AsNoTracking())
            .Where(t => t.SourceAccountId == accountId || t.DestinationAccountId == accountId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(TransferView.From).ToList();
    }

    public async Task CancelAsync(Guid id, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Atualização condicional: se o worker já pegou a transferência, nenhuma linha é afetada.
        var changed = await db.Transfers
            .Where(t => t.Id == id && t.Status == TransferStatus.Scheduled)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Cancelled)
                .SetProperty(t => t.CancelledAt, (DateTime?)now), ct);

        if (changed == 1)
        {
            return;
        }

        if (!await db.Transfers.AnyAsync(t => t.Id == id, ct))
        {
            throw DomainError.NotFound("Transferência não encontrada.");
        }

        throw new DomainError("Somente transferências agendadas podem ser canceladas.");
    }

    /// <summary>
    /// Marca os agendamentos vencidos como despachados e grava a mensagem no outbox, tudo na mesma transação.
    /// O publicador do outbox leva a mensagem ao Kafka depois.
    /// </summary>
    public async Task<int> DispatchDueAsync(int batchSize, string topic, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var staleBefore = now.AddMinutes(-5);
        var scheduled = (int)TransferStatus.Scheduled;
        var processing = (int)TransferStatus.Processing;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // SKIP LOCKED permite várias instâncias da API sem despachar a mesma transferência duas vezes.
        // O segundo ramo recupera agendamentos presos em Processing por uma queda do processo,
        // e o filtro de dispatched_at reenvia mensagens que nunca foram tratadas.
        var ids = await db.Database.SqlQuery<Guid>($"""
            UPDATE transfers
            SET dispatched_at = {now}
            WHERE id IN (
                SELECT id FROM transfers
                WHERE ((status = {scheduled} AND scheduled_at <= {now})
                    OR (status = {processing} AND scheduled_at IS NOT NULL AND claimed_at < {staleBefore}))
                  AND (dispatched_at IS NULL OR dispatched_at < {staleBefore})
                ORDER BY scheduled_at
                LIMIT {batchSize}
                FOR UPDATE SKIP LOCKED)
            RETURNING id AS "Value"
            """).ToListAsync(ct);

        foreach (var id in ids)
        {
            db.OutboxMessages.Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                Topic = topic,
                Key = id.ToString(),
                Payload = JsonSerializer.Serialize(new ScheduledTransferMessage(id)),
                CreatedAt = now
            });
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return ids.Count;
    }

    /// <summary>
    /// Chamado pelo consumidor do Kafka. A entrega é "pelo menos uma vez", então a reserva é condicional:
    /// mensagem repetida, cancelada ou já tratada simplesmente não consegue reservar a transferência.
    /// </summary>
    public async Task ProcessScheduledAsync(Guid transferId, CancellationToken ct)
    {
        if (!await ClaimAsync(transferId, ct))
        {
            log.LogInformation("Transferência {TransferId} ignorada: já tratada, cancelada ou em andamento.", transferId);
            return;
        }

        var failure = await SettleAsync(transferId, ct);
        if (failure is not null)
        {
            log.LogInformation("Agendamento {TransferId} falhou: {Reason}", transferId, failure.Message);
        }
    }

    private async Task<bool> ClaimAsync(Guid transferId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var staleBefore = now.AddMinutes(-5);
        var scheduled = (int)TransferStatus.Scheduled;
        var processing = (int)TransferStatus.Processing;

        var rows = await db.Database.ExecuteSqlAsync($"""
            UPDATE transfers
            SET status = {processing}, claimed_at = {now}
            WHERE id = {transferId}
              AND ((status = {scheduled} AND scheduled_at <= {now})
                OR (status = {processing} AND scheduled_at IS NOT NULL AND claimed_at < {staleBefore}))
            """, ct);

        return rows == 1;
    }

    /// <summary>
    /// Executa uma transferência já em Processing. Devolve o erro de negócio, se houve, depois de gravar a falha.
    /// </summary>
    public async Task<DomainError?> SettleAsync(Guid transferId, CancellationToken ct)
    {
        var info = await db.Transfers.AsNoTracking()
            .Where(t => t.Id == transferId)
            .Select(t => new { t.SourceAccountId, t.Amount })
            .FirstOrDefaultAsync(ct);

        if (info is null)
        {
            return DomainError.NotFound("Transferência não encontrada.");
        }

        var attempt = new TransferAttempt
        {
            AccountId = info.SourceAccountId,
            TransferId = transferId,
            Amount = info.Amount,
            CreatedAt = DateTime.UtcNow,
            Success = false
        };

        db.TransferAttempts.Add(attempt);
        await db.SaveChangesAsync(ct);

        try
        {
            await MoveMoneyAsync(transferId, attempt.Id, ct);
            return null;
        }
        catch (DomainError error)
        {
            db.ChangeTracker.Clear();
            await RecordFailureAsync(transferId, attempt.Id, error.Message, ct);
            return error;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Falha inesperada ao processar a transferência {TransferId}.", transferId);
            db.ChangeTracker.Clear();
            await RecordFailureAsync(transferId, attempt.Id, "Erro interno ao processar a transferência.", CancellationToken.None);
            throw;
        }
    }

    private async Task MoveMoneyAsync(Guid transferId, long attemptId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var transfer = await db.Transfers.FirstAsync(t => t.Id == transferId, ct);
        var ids = new[] { transfer.SourceAccountId, transfer.DestinationAccountId };

        // Trava as duas contas sempre em ordem de id, o que evita deadlock entre transferências cruzadas.
        var locked = await db.Accounts
            .FromSql($"SELECT * FROM accounts WHERE id = ANY({ids}) ORDER BY id FOR UPDATE")
            .ToListAsync(ct);

        var source = locked.FirstOrDefault(a => a.Id == transfer.SourceAccountId)
            ?? throw DomainError.NotFound("Conta de origem não encontrada.");
        var destination = locked.FirstOrDefault(a => a.Id == transfer.DestinationAccountId)
            ?? throw DomainError.NotFound("Conta de destino não encontrada.");

        EnsureActive(source, destination);
        await limits.EnforceAsync(source, transfer.Amount, ct);

        if (source.Balance + source.OverdraftLimit < transfer.Amount)
        {
            throw new DomainError("Saldo e cheque especial insuficientes.");
        }

        source.Balance -= transfer.Amount;
        destination.Balance += transfer.Amount;

        transfer.Status = TransferStatus.Completed;
        transfer.ProcessedAt = DateTime.UtcNow;
        transfer.FailureReason = null;

        var attempt = await db.TransferAttempts.FirstAsync(a => a.Id == attemptId, ct);
        attempt.Success = true;
        attempt.FailureReason = null;

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private async Task RecordFailureAsync(Guid transferId, long attemptId, string reason, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        await db.Transfers
            .Where(t => t.Id == transferId && t.Status != TransferStatus.Completed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, TransferStatus.Failed)
                .SetProperty(t => t.FailureReason, reason)
                .SetProperty(t => t.ProcessedAt, (DateTime?)now), ct);

        await db.TransferAttempts
            .Where(a => a.Id == attemptId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.Success, false)
                .SetProperty(a => a.FailureReason, reason), ct);
    }

    private async Task<Transfer?> TrySaveNewAsync(Transfer transfer, string? key, CancellationToken ct)
    {
        db.Transfers.Add(transfer);

        try
        {
            await db.SaveChangesAsync(ct);
            return null;
        }
        catch (DbUpdateException) when (key is not null)
        {
            // Duas requisições com a mesma chave chegaram juntas: o índice único deixa só uma passar.
            db.ChangeTracker.Clear();
            return await FindByKeyAsync(key, ct) ?? throw new DomainError("Não foi possível registrar a transferência.");
        }
    }

    private async Task<Dictionary<int, Account>> EnsureAccountsExistAsync(int sourceId, int destinationId, CancellationToken ct)
    {
        var ids = new[] { sourceId, destinationId };
        var accounts = await db.Accounts.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, ct);

        if (!accounts.ContainsKey(sourceId))
        {
            throw DomainError.NotFound("Conta de origem não encontrada.");
        }

        if (!accounts.ContainsKey(destinationId))
        {
            throw DomainError.NotFound("Conta de destino não encontrada.");
        }

        return accounts;
    }

    private static void EnsureActive(Account source, Account destination)
    {
        if (source.Status != AccountStatus.Active)
        {
            throw new DomainError("A conta de origem não está ativa.");
        }

        if (destination.Status != AccountStatus.Active)
        {
            throw new DomainError("A conta de destino não está ativa.");
        }
    }

    private static void CheckBasics(int sourceId, int destinationId, decimal amount)
    {
        if (sourceId <= 0)
        {
            throw new DomainError("A conta de origem é obrigatória.");
        }

        if (destinationId <= 0)
        {
            throw new DomainError("A conta de destino é obrigatória.");
        }

        if (sourceId == destinationId)
        {
            throw new DomainError("A conta de origem e destino devem ser diferentes.");
        }

        if (amount <= 0)
        {
            throw new DomainError("O valor da transferência deve ser maior que zero.");
        }

        if (amount > MaxAmount)
        {
            throw new DomainError("O valor da transferência excede o máximo permitido.");
        }

        if (decimal.Round(amount, 2) != amount)
        {
            throw new DomainError("O valor da transferência deve ter no máximo duas casas decimais.");
        }
    }

    private static string? CleanKey(string? key) =>
        string.IsNullOrWhiteSpace(key) ? null : key.Trim();

    private static IQueryable<Transfer> WithNames(IQueryable<Transfer> query) => query
        .Include(t => t.SourceAccount).ThenInclude(a => a.Person)
        .Include(t => t.DestinationAccount).ThenInclude(a => a.Person);

    private Task<Transfer?> FindByKeyAsync(string key, CancellationToken ct) =>
        WithNames(db.Transfers.AsNoTracking()).FirstOrDefaultAsync(t => t.IdempotencyKey == key, ct);

    private async Task<Transfer> LoadAsync(Guid id, CancellationToken ct) =>
        await WithNames(db.Transfers.AsNoTracking()).FirstOrDefaultAsync(t => t.Id == id, ct)
        ?? throw DomainError.NotFound("Transferência não encontrada.");
}
