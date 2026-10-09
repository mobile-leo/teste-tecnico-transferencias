using Microsoft.Extensions.Options;
using Transferencias.Features.Messaging;

namespace Transferencias.Features.Transfers;

// Só descobre quais agendamentos venceram e os coloca no outbox; quem executa é o consumidor do Kafka.
public sealed class ScheduledTransferWorker(
    IServiceScopeFactory scopes,
    IOptions<KafkaOptions> kafka,
    ILogger<ScheduledTransferWorker> log) : BackgroundService
{
    private const int BatchSize = 100;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        using var timer = new PeriodicTimer(PollInterval);

        try
        {
            do
            {
                try
                {
                    int dispatched;
                    do
                    {
                        await using var scope = scopes.CreateAsyncScope();
                        var desk = scope.ServiceProvider.GetRequiredService<TransferDesk>();
                        dispatched = await desk.DispatchDueAsync(BatchSize, kafka.Value.Topic, stopping);

                        if (dispatched > 0)
                        {
                            log.LogInformation("{Count} agendamento(s) enviado(s) ao outbox.", dispatched);
                        }
                    }
                    while (dispatched == BatchSize);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Falha ao verificar transferências agendadas.");
                }
            }
            while (await timer.WaitForNextTickAsync(stopping));
        }
        catch (OperationCanceledException)
        {
        }
    }
}
