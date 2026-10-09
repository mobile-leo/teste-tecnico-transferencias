using Microsoft.AspNetCore.Diagnostics;

namespace Transferencias.Common;

public class DomainError(string message, int status = StatusCodes.Status400BadRequest) : Exception(message)
{
    public int Status { get; } = status;

    public static DomainError NotFound(string message) => new(message, StatusCodes.Status404NotFound);

    public static DomainError TooMany(string message) => new(message, StatusCodes.Status429TooManyRequests);
}

public sealed class ErrorHandler(ILogger<ErrorHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception error, CancellationToken ct)
    {
        var (status, message) = error switch
        {
            DomainError e => (e.Status, e.Message),
            BadHttpRequestException => (StatusCodes.Status400BadRequest, "Requisição inválida."),
            _ => (StatusCodes.Status500InternalServerError, "Ocorreu um erro interno no servidor.")
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            log.LogError(error, "Erro não tratado.");
        }

        http.Response.StatusCode = status;
        await http.Response.WriteAsJsonAsync(new { statusCode = status, message }, ct);
        return true;
    }
}

public class TransferRules
{
    public string TimeZone { get; set; } = "America/Sao_Paulo";
    public int DayStartHour { get; set; } = 6;
    public int NightStartHour { get; set; } = 22;
    public decimal DefaultDayHourlyAmountLimit { get; set; } = 10000m;
    public int DefaultDayHourlyAttemptLimit { get; set; } = 10;
    public decimal DefaultNightHourlyAmountLimit { get; set; } = 1000m;
    public int DefaultNightHourlyAttemptLimit { get; set; } = 3;
}
