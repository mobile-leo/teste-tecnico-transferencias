using Microsoft.AspNetCore.Mvc;

namespace Transferencias.Features.Transfers;

public static class TransferEndpoints
{
    public static void MapTransfers(this IEndpointRouteBuilder app)
    {
        var transfers = app.MapGroup("/api/transfers").WithTags("Transfers");

        transfers.MapPost("/", async (
            TransferInput input,
            [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
            TransferDesk desk,
            CancellationToken ct) =>
            Results.Ok(await desk.TransferNowAsync(input, idempotencyKey, ct)));

        transfers.MapPost("/scheduled", async (
            ScheduleInput input,
            [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
            TransferDesk desk,
            CancellationToken ct) =>
        {
            var created = await desk.ScheduleAsync(input, idempotencyKey, ct);
            return Results.Created($"/api/transfers/{created.Id}", created);
        });

        transfers.MapGet("/{id:guid}", async (Guid id, TransferDesk desk, CancellationToken ct) =>
            Results.Ok(await desk.GetAsync(id, ct)));

        transfers.MapPost("/{id:guid}/cancel", async (Guid id, TransferDesk desk, CancellationToken ct) =>
        {
            await desk.CancelAsync(id, ct);
            return Results.NoContent();
        });

        app.MapGet("/api/transfer-history/accounts/{accountId:int}",
                async (int accountId, TransferDesk desk, CancellationToken ct) =>
                    Results.Ok(await desk.HistoryAsync(accountId, ct)))
            .WithTags("Transfers");
    }
}
