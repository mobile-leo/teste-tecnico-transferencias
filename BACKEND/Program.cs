using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Transferencias.Common;
using Transferencias.Data;
using Transferencias.Features.Accounts;
using Transferencias.Features.Messaging;
using Transferencias.Features.People;
using Transferencias.Features.Transfers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BankDb>(options => options
    .UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
    .UseSnakeCaseNamingConvention());

builder.Services.Configure<TransferRules>(builder.Configuration.GetSection("TransferRules"));
builder.Services.Configure<KafkaOptions>(builder.Configuration.GetSection("Kafka"));

builder.Services.AddScoped<LimitPolicy>();
builder.Services.AddScoped<TransferDesk>();
builder.Services.AddSingleton<IMessageBus, KafkaBus>();

builder.Services.AddHostedService<ScheduledTransferWorker>();
builder.Services.AddHostedService<OutboxPublisherWorker>();
builder.Services.AddHostedService<ScheduledTransferConsumer>();

builder.Services.ConfigureHttpJsonOptions(json =>
    json.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddExceptionHandler<ErrorHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "API de Transferências",
        Version = "v1",
        Description = "Pessoas, contas e transferências imediatas ou agendadas."
    }));

var app = builder.Build();

await PrepareDatabaseAsync(app);

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapPeople();
app.MapAccounts();
app.MapTransfers();

app.Run();

static async Task PrepareDatabaseAsync(WebApplication app)
{
    const int maxAttempts = 10;

    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await using var scope = app.Services.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<BankDb>().Database.MigrateAsync();
            return;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            app.Logger.LogWarning(ex, "Banco indisponível (tentativa {Attempt}/{Max}). Nova tentativa em 3s.", attempt, maxAttempts);
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}
