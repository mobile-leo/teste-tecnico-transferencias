using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Transferencias.Common;
using Transferencias.Data;
using Transferencias.Domain;
using Transferencias.Features.Accounts;

namespace Transferencias.Features.People;

public record PersonInput(
    string? Name,
    string? Document,
    DateOnly? BirthDate,
    string? Email,
    string? Phone,
    string? ZipCode,
    string? Street,
    string? Number,
    string? Complement,
    string? Neighborhood,
    string? City,
    string? State);

public record PersonView(
    int Id,
    string Name,
    string? Document,
    DateOnly? BirthDate,
    string? Email,
    string? Phone,
    string? ZipCode,
    string? Street,
    string? Number,
    string? Complement,
    string? Neighborhood,
    string? City,
    string? State,
    int? AccountId)
{
    public static PersonView From(Person p) => new(
        p.Id, p.Name, p.Document, p.BirthDate, p.Email, p.Phone, p.ZipCode, p.Street,
        p.Number, p.Complement, p.Neighborhood, p.City, p.State, p.Account?.Id);
}

public static class PeopleEndpoints
{
    public static void MapPeople(this IEndpointRouteBuilder app)
    {
        var people = app.MapGroup("/api/persons").WithTags("Persons");

        people.MapGet("/", async (BankDb db, CancellationToken ct) =>
        {
            var rows = await db.People.AsNoTracking()
                .Include(p => p.Account)
                .OrderBy(p => p.Name)
                .ToListAsync(ct);

            return Results.Ok(rows.Select(PersonView.From));
        });

        people.MapGet("/{id:int}", async (int id, BankDb db, CancellationToken ct) =>
        {
            RequireValidId(id);
            return Results.Ok(PersonView.From(await FindAsync(db, id, ct, track: false)));
        });

        people.MapPost("/", async (PersonInput input, BankDb db, CancellationToken ct) =>
        {
            var person = new Person();
            await ApplyAsync(db, person, input, ct);

            db.People.Add(person);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/api/persons/{person.Id}", PersonView.From(person));
        });

        people.MapPut("/{id:int}", async (int id, PersonInput input, BankDb db, CancellationToken ct) =>
        {
            RequireValidId(id);
            var person = await FindAsync(db, id, ct, track: true);

            await ApplyAsync(db, person, input, ct);
            await db.SaveChangesAsync(ct);

            return Results.Ok(PersonView.From(person));
        });

        people.MapDelete("/{id:int}", async (int id, BankDb db, CancellationToken ct) =>
        {
            RequireValidId(id);
            var person = await FindAsync(db, id, ct, track: true);

            await using var tx = await db.Database.BeginTransactionAsync(ct);

            if (person.Account is not null)
            {
                await AccountEndpoints.DeleteDependenciesAsync(db, [person.Account.Id], ct);
            }

            db.People.Remove(person);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Results.NoContent();
        });
    }

    private static void RequireValidId(int id)
    {
        if (id <= 0)
        {
            throw new DomainError("O identificador da pessoa é inválido.");
        }
    }

    private static async Task<Person> FindAsync(BankDb db, int id, CancellationToken ct, bool track)
    {
        var query = db.People.Include(p => p.Account).AsQueryable();
        if (!track)
        {
            query = query.AsNoTracking();
        }

        return await query.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw DomainError.NotFound("Pessoa não encontrada.");
    }

    private static async Task ApplyAsync(BankDb db, Person person, PersonInput input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.Name))
        {
            throw new DomainError("O nome da pessoa é obrigatório.");
        }

        if (input.Name.Trim().Length > 150)
        {
            throw new DomainError("O nome da pessoa deve possuir no máximo 150 caracteres.");
        }

        var document = DigitsOnly(input.Document);
        var email = Clean(input.Email)?.ToLowerInvariant();

        if (email is not null && !new EmailAddressAttribute().IsValid(email))
        {
            throw new DomainError("O e-mail informado é inválido.");
        }

        if (document is not null
            && await db.People.AnyAsync(p => p.Document == document && p.Id != person.Id, ct))
        {
            throw new DomainError("Já existe uma pessoa cadastrada com este documento.");
        }

        if (email is not null
            && await db.People.AnyAsync(p => p.Email == email && p.Id != person.Id, ct))
        {
            throw new DomainError("Já existe uma pessoa cadastrada com este e-mail.");
        }

        if (input.BirthDate is { } birth && birth > DateOnly.FromDateTime(DateTime.UtcNow))
        {
            throw new DomainError("A data de nascimento não pode ser futura.");
        }

        var state = Clean(input.State);
        if (state is not null && state.Length != 2)
        {
            throw new DomainError("O estado deve ser informado com a sigla de 2 caracteres.");
        }

        LimitLength(document, 20, "documento");
        LimitLength(email, 150, "e-mail");
        LimitLength(Clean(input.Phone), 20, "telefone");
        LimitLength(Clean(input.ZipCode), 10, "CEP");
        LimitLength(Clean(input.Street), 150, "logradouro");
        LimitLength(Clean(input.Number), 20, "número");
        LimitLength(Clean(input.Complement), 100, "complemento");
        LimitLength(Clean(input.Neighborhood), 100, "bairro");
        LimitLength(Clean(input.City), 100, "cidade");

        person.Name = input.Name.Trim();
        person.Document = document;
        person.BirthDate = input.BirthDate;
        person.Email = email;
        person.Phone = Clean(input.Phone);
        person.ZipCode = Clean(input.ZipCode);
        person.Street = Clean(input.Street);
        person.Number = Clean(input.Number);
        person.Complement = Clean(input.Complement);
        person.Neighborhood = Clean(input.Neighborhood);
        person.City = Clean(input.City);
        person.State = state?.ToUpperInvariant();
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? DigitsOnly(string? value)
    {
        var digits = new string((Clean(value) ?? "").Where(char.IsDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }

    private static void LimitLength(string? value, int max, string label)
    {
        if (value is not null && value.Length > max)
        {
            throw new DomainError($"O campo {label} deve possuir no máximo {max} caracteres.");
        }
    }
}
