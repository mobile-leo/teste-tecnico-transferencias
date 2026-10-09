using Microsoft.EntityFrameworkCore;
using Transferencias.Common;
using Transferencias.Data;
using Transferencias.Domain;
using Transferencias.Features.Transfers;

namespace Transferencias.Features.Accounts;

public record CreateAccountInput(int PersonId, decimal Balance, decimal OverdraftLimit, AccountStatus Status);

public record UpdateAccountInput(int PersonId, decimal OverdraftLimit, AccountStatus Status);

public record AccountView(
    int Id,
    int PersonId,
    string PersonName,
    decimal Balance,
    decimal OverdraftLimit,
    decimal AvailableBalance,
    string Status)
{
    public static AccountView From(Account a) => new(
        a.Id,
        a.PersonId,
        a.Person.Name,
        a.Balance,
        a.OverdraftLimit,
        a.Balance + a.OverdraftLimit,
        a.Status.ToString());
}

public static class AccountEndpoints
{
    public static void MapAccounts(this IEndpointRouteBuilder app)
    {
        var accounts = app.MapGroup("/api/accounts").WithTags("Accounts");

        accounts.MapGet("/", async (BankDb db, CancellationToken ct) =>
        {
            var rows = await db.Accounts.AsNoTracking()
                .Include(a => a.Person)
                .OrderBy(a => a.Id)
                .ToListAsync(ct);

            return Results.Ok(rows.Select(AccountView.From));
        });

        accounts.MapGet("/{id:int}", async (int id, BankDb db, CancellationToken ct) =>
        {
            var account = await db.Accounts.AsNoTracking()
                .Include(a => a.Person)
                .FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw DomainError.NotFound("Conta não encontrada.");

            return Results.Ok(AccountView.From(account));
        });

        accounts.MapPost("/", async (CreateAccountInput input, BankDb db, LimitPolicy limits, CancellationToken ct) =>
        {
            if (await db.Accounts.AnyAsync(a => a.PersonId == input.PersonId, ct))
            {
                throw new DomainError("Esta pessoa já possui uma conta cadastrada.");
            }

            if (!await db.People.AnyAsync(p => p.Id == input.PersonId, ct))
            {
                throw DomainError.NotFound("Pessoa não encontrada.");
            }

            if (input.Balance < 0)
            {
                throw new DomainError("O saldo inicial não pode ser negativo.");
            }

            ValidateOverdraft(input.OverdraftLimit);
            ValidateStatus(input.Status);

            await EnsureLimitAsync(db, limits, input.PersonId, ct);

            var account = new Account
            {
                PersonId = input.PersonId,
                Balance = input.Balance,
                OverdraftLimit = input.OverdraftLimit,
                Status = input.Status
            };

            db.Accounts.Add(account);
            await db.SaveChangesAsync(ct);

            var saved = await db.Accounts.AsNoTracking()
                .Include(a => a.Person)
                .FirstAsync(a => a.Id == account.Id, ct);

            return Results.Created($"/api/accounts/{saved.Id}", AccountView.From(saved));
        });

        accounts.MapPut("/{id:int}", async (int id, UpdateAccountInput input, BankDb db, LimitPolicy limits, CancellationToken ct) =>
        {
            var account = await db.Accounts.Include(a => a.Person)
                .FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw DomainError.NotFound("Conta não encontrada.");

            ValidateOverdraft(input.OverdraftLimit);
            ValidateStatus(input.Status);

            var person = await db.People.FirstOrDefaultAsync(p => p.Id == input.PersonId, ct)
                ?? throw DomainError.NotFound("Pessoa não encontrada.");

            if (await db.Accounts.AnyAsync(a => a.PersonId == input.PersonId && a.Id != id, ct))
            {
                throw new DomainError("Esta pessoa já possui uma conta cadastrada.");
            }

            account.PersonId = person.Id;
            account.Person = person;
            account.OverdraftLimit = input.OverdraftLimit;
            account.Status = input.Status;

            await EnsureLimitAsync(db, limits, person.Id, ct);
            await db.SaveChangesAsync(ct);

            return Results.Ok(AccountView.From(account));
        });

        accounts.MapDelete("/{id:int}", async (int id, BankDb db, CancellationToken ct) =>
        {
            var account = await db.Accounts.FirstOrDefaultAsync(a => a.Id == id, ct)
                ?? throw DomainError.NotFound("Conta não encontrada.");

            await using var tx = await db.Database.BeginTransactionAsync(ct);

            await DeleteDependenciesAsync(db, [id], ct);
            db.Accounts.Remove(account);
            await db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);
            return Results.NoContent();
        });
    }

    public static async Task DeleteDependenciesAsync(BankDb db, int[] accountIds, CancellationToken ct)
    {
        var transferIds = db.Transfers
            .Where(t => accountIds.Contains(t.SourceAccountId) || accountIds.Contains(t.DestinationAccountId))
            .Select(t => t.Id);

        await db.TransferAttempts
            .Where(a => accountIds.Contains(a.AccountId)
                        || (a.TransferId != null && transferIds.Contains(a.TransferId.Value)))
            .ExecuteDeleteAsync(ct);

        await db.Transfers
            .Where(t => accountIds.Contains(t.SourceAccountId) || accountIds.Contains(t.DestinationAccountId))
            .ExecuteDeleteAsync(ct);
    }

    private static async Task EnsureLimitAsync(BankDb db, LimitPolicy limits, int personId, CancellationToken ct)
    {
        var exists = db.TransferLimits.Local.Any(l => l.PersonId == personId)
                     || await db.TransferLimits.AnyAsync(l => l.PersonId == personId, ct);

        if (!exists)
        {
            db.TransferLimits.Add(limits.CreateDefaultFor(personId));
        }
    }

    private static void ValidateOverdraft(decimal overdraft)
    {
        if (overdraft < 0)
        {
            throw new DomainError("O limite de cheque especial não pode ser negativo.");
        }
    }

    private static void ValidateStatus(AccountStatus status)
    {
        if (!Enum.IsDefined(status))
        {
            throw new DomainError("O status da conta é inválido.");
        }
    }
}
