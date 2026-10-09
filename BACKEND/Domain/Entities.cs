namespace Transferencias.Domain;

public enum AccountStatus
{
    Active = 1,
    Blocked = 2,
    Inactive = 3
}

public enum TransferStatus
{
    Scheduled = 1,
    Processing = 2,
    Completed = 3,
    Failed = 4,
    Cancelled = 5
}

public class Person
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string? Document { get; set; }
    public DateOnly? BirthDate { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? ZipCode { get; set; }
    public string? Street { get; set; }
    public string? Number { get; set; }
    public string? Complement { get; set; }
    public string? Neighborhood { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }

    public Account? Account { get; set; }
    public TransferLimit? Limit { get; set; }
}

public class Account
{
    public int Id { get; set; }
    public int PersonId { get; set; }
    public decimal Balance { get; set; }
    public decimal OverdraftLimit { get; set; }
    public AccountStatus Status { get; set; }

    public Person Person { get; set; } = null!;
}

public class TransferLimit
{
    public int Id { get; set; }
    public int PersonId { get; set; }
    public decimal DayHourlyAmountLimit { get; set; }
    public int DayHourlyAttemptLimit { get; set; }
    public decimal NightHourlyAmountLimit { get; set; }
    public int NightHourlyAttemptLimit { get; set; }

    public Person Person { get; set; } = null!;
}

public class Transfer
{
    public Guid Id { get; set; }
    public int SourceAccountId { get; set; }
    public int DestinationAccountId { get; set; }
    public decimal Amount { get; set; }
    public TransferStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public DateTime? ClaimedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? FailureReason { get; set; }
    public string? IdempotencyKey { get; set; }

    public Account SourceAccount { get; set; } = null!;
    public Account DestinationAccount { get; set; } = null!;
}

public class OutboxMessage
{
    public Guid Id { get; set; }
    public string Topic { get; set; } = "";
    public string Key { get; set; } = "";
    public string Payload { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}

public class TransferAttempt
{
    public long Id { get; set; }
    public int AccountId { get; set; }
    public Guid? TransferId { get; set; }
    public decimal Amount { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool Success { get; set; }
    public string? FailureReason { get; set; }
}
