using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;
using Transferencias.Features.Transfers;

namespace Transferencias.Features.Messaging;

public sealed class ScheduledTransferConsumer(
    IServiceScopeFactory scopes,
    IOptions<KafkaOptions> options,
    ILogger<ScheduledTransferConsumer> log) : BackgroundService
{
    private static readonly TimeSpan PollTimeout = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        // Consume bloqueia a thread; ceder o controle antes evita travar a inicialização do host.
        await Task.Yield();

        var kafka = options.Value;

        using var consumer = new ConsumerBuilder<string, string>(new ConsumerConfig
        {
            BootstrapServers = kafka.BootstrapServers,
            GroupId = kafka.GroupId,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        })
        .SetErrorHandler((_, error) => log.LogWarning("Kafka: {Reason}", error.Reason))
        .Build();

        consumer.Subscribe(kafka.Topic);
        log.LogInformation("Consumidor inscrito no tópico {Topic}.", kafka.Topic);

        try
        {
            while (!stopping.IsCancellationRequested)
            {
                ConsumeResult<string, string>? record = null;

                try
                {
                    record = consumer.Consume(PollTimeout);
                    if (record?.Message is null)
                    {
                        continue;
                    }

                    await HandleAsync(record.Message.Value, stopping);
                    consumer.Commit(record);
                }
                catch (ConsumeException ex)
                {
                    log.LogWarning(ex, "Erro ao consumir do Kafka.");
                    await Task.Delay(RetryDelay, stopping);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    log.LogError(ex, "Falha ao tratar a mensagem; ela será reentregue.");

                    // Sem o commit, voltamos o offset para reprocessar a mesma mensagem.
                    if (record is not null)
                    {
                        consumer.Seek(record.TopicPartitionOffset);
                    }

                    await Task.Delay(RetryDelay, stopping);
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
        finally
        {
            consumer.Close();
        }
    }

    private async Task HandleAsync(string raw, CancellationToken ct)
    {
        ScheduledTransferMessage? message;

        try
        {
            message = JsonSerializer.Deserialize<ScheduledTransferMessage>(raw);
        }
        catch (JsonException)
        {
            message = null;
        }

        if (message is null || message.TransferId == Guid.Empty)
        {
            log.LogWarning("Mensagem inválida descartada: {Payload}", raw);
            return;
        }

        await using var scope = scopes.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<TransferDesk>().ProcessScheduledAsync(message.TransferId, ct);
    }
}
