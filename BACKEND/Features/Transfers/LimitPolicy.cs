using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Transferencias.Common;
using Transferencias.Data;
using Transferencias.Domain;

namespace Transferencias.Features.Transfers;

public class LimitPolicy(BankDb db, IOptions<TransferRules> options)
{
    private readonly TransferRules rules = options.Value;

    public TransferLimit CreateDefaultFor(int personId) => new()
    {
        PersonId = personId,
        DayHourlyAmountLimit = rules.DefaultDayHourlyAmountLimit,
        DayHourlyAttemptLimit = rules.DefaultDayHourlyAttemptLimit,
        NightHourlyAmountLimit = rules.DefaultNightHourlyAmountLimit,
        NightHourlyAttemptLimit = rules.DefaultNightHourlyAttemptLimit
    };

    public async Task EnforceAsync(Account source, decimal amount, CancellationToken ct)
    {
        var limit = await db.TransferLimits.AsNoTracking()
            .FirstOrDefaultAsync(l => l.PersonId == source.PersonId, ct)
            ?? throw new DomainError("Limites de transferência não configurados para esta pessoa.");

        var now = DateTime.UtcNow;
        var windowStart = now.AddHours(-1);
        var local = ToLocal(now);
        var isNight = local.Hour >= rules.NightStartHour || local.Hour < rules.DayStartHour;

        var maxAmount = isNight ? limit.NightHourlyAmountLimit : limit.DayHourlyAmountLimit;
        var maxAttempts = isNight ? limit.NightHourlyAttemptLimit : limit.DayHourlyAttemptLimit;

        // A tentativa em curso já foi gravada, então ela entra na contagem.
        var attempts = await db.TransferAttempts.AsNoTracking()
            .Where(a => a.AccountId == source.Id && a.CreatedAt >= windowStart)
            .OrderBy(a => a.CreatedAt)
            .Select(a => a.CreatedAt)
            .ToListAsync(ct);

        if (attempts.Count > maxAttempts)
        {
            throw DomainError.TooMany(
                WithRetryHint("Limite de tentativas por hora excedido.", attempts[0].AddHours(1)));
        }

        var completed = await db.Transfers.AsNoTracking()
            .Where(t => t.SourceAccountId == source.Id
                        && t.Status == TransferStatus.Completed
                        && t.ProcessedAt >= windowStart)
            .OrderBy(t => t.ProcessedAt)
            .Select(t => new { t.Amount, t.ProcessedAt })
            .ToListAsync(ct);

        var used = completed.Sum(t => t.Amount);
        if (used + amount <= maxAmount)
        {
            return;
        }

        DateTime? retryAt = null;
        if (amount <= maxAmount)
        {
            var stillCounted = used;
            foreach (var t in completed)
            {
                stillCounted -= t.Amount;
                if (stillCounted + amount <= maxAmount)
                {
                    retryAt = t.ProcessedAt?.AddHours(1);
                    break;
                }
            }
        }

        throw DomainError.TooMany(WithRetryHint(
            $"Limite de transferência por hora excedido. Limite atual: {FormatMoney(maxAmount)}.",
            retryAt));
    }

    private string WithRetryHint(string message, DateTime? retryAtUtc)
    {
        if (retryAtUtc is null)
        {
            return message;
        }

        var local = ToLocal(retryAtUtc.Value);
        return $"{message} Você poderá transferir novamente a partir de {local.ToString("dd/MM/yyyy, HH:mm", CultureInfo.InvariantCulture)}.";
    }

    private DateTime ToLocal(DateTime utc)
    {
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(rules.TimeZone);
            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return utc;
        }
    }

    private static string FormatMoney(decimal value)
    {
        var invariant = value.ToString("N2", CultureInfo.InvariantCulture);
        var swapped = invariant.Replace(',', '#').Replace('.', ',').Replace('#', '.');
        return $"R$ {swapped}";
    }
}
