using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Transferencias.Data;

// Usada só pelo `dotnet ef`: evita subir a aplicação inteira (e tentar conectar no banco) ao gerar migrations.
public sealed class BankDbFactory : IDesignTimeDbContextFactory<BankDb>
{
    public BankDb CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<BankDb>()
            .UseNpgsql("Host=localhost;Database=bank_transfers;Username=postgres;Password=postgres")
            .UseSnakeCaseNamingConvention()
            .Options;

        return new BankDb(options);
    }
}
