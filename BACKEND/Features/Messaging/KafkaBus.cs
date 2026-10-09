using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace Transferencias.Features.Messaging;

public sealed class KafkaOptions
{
    public string BootstrapServers { get; set; } = "";
    public string Topic { get; set; } = "scheduled-transfers";
    public string GroupId { get; set; } = "scheduled-transfer-workers";
}

public record ScheduledTransferMessage(Guid TransferId);

public interface IMessageBus
{
    Task PublishAsync(string topic, string key, string payload, CancellationToken ct);
}

public sealed class KafkaBus : IMessageBus, IDisposable
{
    private readonly IProducer<string, string> producer;

    public KafkaBus(IOptions<KafkaOptions> options)
    {
        var servers = options.Value.BootstrapServers;
        if (string.IsNullOrWhiteSpace(servers))
        {
            throw new InvalidOperationException("Kafka:BootstrapServers não foi configurado.");
        }

        producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = servers,
            Acks = Acks.All,
            EnableIdempotence = true,
            MessageTimeoutMs = 10_000
        }).Build();
    }

    public async Task PublishAsync(string topic, string key, string payload, CancellationToken ct)
    {
        await producer.ProduceAsync(topic, new Message<string, string> { Key = key, Value = payload }, ct);
    }

    public void Dispose()
    {
        producer.Flush(TimeSpan.FromSeconds(5));
        producer.Dispose();
    }
}
