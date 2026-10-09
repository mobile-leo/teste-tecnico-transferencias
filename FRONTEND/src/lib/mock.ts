import type { Account, AccountStatusName, Person, Transfer } from './types'
import { ApiError } from './errors'

// In-memory backend used only when VITE_API_MOCK=true, so the UI can be explored without .NET/Kafka/Postgres.

interface AccountRecord {
  id: number
  personId: number
  balance: number
  overdraftLimit: number
  status: AccountStatusName
}

const statusNames: Record<number, AccountStatusName> = { 1: 'Active', 2: 'Blocked', 3: 'Inactive' }

const emptyPerson = {
  document: null,
  birthDate: null,
  phone: null,
  zipCode: null,
  street: null,
  number: null,
  complement: null,
  neighborhood: null,
}

let persons: Omit<Person, 'accountId'>[] = [
  { ...emptyPerson, id: 1, name: 'Marina Albuquerque', email: 'marina@email.com', document: '123.456.789-00', city: 'São Paulo', state: 'SP' },
  { ...emptyPerson, id: 2, name: 'Rafael Tavares', email: 'rafael@email.com', document: '987.654.321-00', city: 'Campinas', state: 'SP' },
  { ...emptyPerson, id: 3, name: 'Construtora Horizonte Ltda', email: 'financeiro@horizonte.com', document: '12.345.678/0001-90', city: 'Curitiba', state: 'PR' },
  { ...emptyPerson, id: 4, name: 'Beatriz Nogueira', email: 'bia@email.com', city: 'Belo Horizonte', state: 'MG' },
]

let accounts: AccountRecord[] = [
  { id: 1, personId: 1, balance: 12450.9, overdraftLimit: 2000, status: 'Active' },
  { id: 2, personId: 2, balance: -320.5, overdraftLimit: 1000, status: 'Active' },
  { id: 3, personId: 3, balance: 184300, overdraftLimit: 50000, status: 'Active' },
]

const now = Date.now()
const hour = 3_600_000

let transfers: Transfer[] = [
  {
    id: 'a3f1c2d4-0b6e-4f7a-9c1d-2e3f4a5b6c7d',
    sourceAccountId: 3,
    destinationAccountId: 1,
    sourceAccountName: null,
    destinationAccountName: null,
    amount: 4800,
    status: 'Completed',
    createdAt: new Date(now - 26 * hour).toISOString(),
    scheduledAt: null,
    processedAt: new Date(now - 26 * hour).toISOString(),
    cancelledAt: null,
    failureReason: null,
  },
  {
    id: 'b7e2d3c4-1a5f-4b8e-8d2c-3f4a5b6c7d8e',
    sourceAccountId: 1,
    destinationAccountId: 2,
    sourceAccountName: null,
    destinationAccountName: null,
    amount: 650,
    status: 'Completed',
    createdAt: new Date(now - 5 * hour).toISOString(),
    scheduledAt: null,
    processedAt: new Date(now - 5 * hour).toISOString(),
    cancelledAt: null,
    failureReason: null,
  },
  {
    id: 'c9a4e5f6-2b7c-4d9e-9f3a-4b5c6d7e8f90',
    sourceAccountId: 1,
    destinationAccountId: 3,
    sourceAccountName: null,
    destinationAccountName: null,
    amount: 1200,
    status: 'Scheduled',
    createdAt: new Date(now - 2 * hour).toISOString(),
    scheduledAt: new Date(now + 48 * hour).toISOString(),
    processedAt: null,
    cancelledAt: null,
    failureReason: null,
  },
]

let nextPersonId = 5
let nextAccountId = 4

const personName = (personId: number) => persons.find((p) => p.id === personId)?.name ?? null

function toAccount(record: AccountRecord): Account {
  return {
    ...record,
    personName: personName(record.personId),
    availableBalance: record.balance + record.overdraftLimit,
  }
}

function toPerson(person: Omit<Person, 'accountId'>): Person {
  return { ...person, accountId: accounts.find((a) => a.personId === person.id)?.id ?? null }
}

function withNames(transfer: Transfer): Transfer {
  const source = accounts.find((a) => a.id === transfer.sourceAccountId)
  const destination = accounts.find((a) => a.id === transfer.destinationAccountId)
  return {
    ...transfer,
    sourceAccountName: source ? personName(source.personId) : null,
    destinationAccountName: destination ? personName(destination.personId) : null,
  }
}

function fail(status: number, message: string): never {
  throw new ApiError(status, { message }, message)
}

function findAccount(id: number) {
  return accounts.find((a) => a.id === id) ?? fail(404, `Conta ${id} não encontrada.`)
}

function validateTransfer(sourceId: number, destinationId: number, amount: number) {
  if (sourceId === destinationId) fail(400, 'A conta de origem e a de destino devem ser diferentes.')
  if (!(amount > 0)) fail(400, 'O valor da transferência deve ser maior que zero.')
  const source = findAccount(sourceId)
  const destination = findAccount(destinationId)
  if (source.status !== 'Active') fail(422, 'A conta de origem não está ativa.')
  if (destination.status !== 'Active') fail(422, 'A conta de destino não está ativa.')
  return { source, destination }
}

function execute(transfer: Transfer) {
  try {
    const { source, destination } = validateTransfer(transfer.sourceAccountId, transfer.destinationAccountId, transfer.amount)
    if (source.balance + source.overdraftLimit < transfer.amount) {
      fail(422, 'Saldo insuficiente, considerando o limite de cheque especial.')
    }
    source.balance = round(source.balance - transfer.amount)
    destination.balance = round(destination.balance + transfer.amount)
    transfer.status = 'Completed'
  } catch (error) {
    transfer.status = 'Failed'
    transfer.failureReason = error instanceof Error ? error.message : 'Falha ao processar.'
  }
  transfer.processedAt = new Date().toISOString()
}

const round = (value: number) => Math.round(value * 100) / 100

function processDueScheduled() {
  for (const transfer of transfers) {
    if (transfer.status === 'Scheduled' && transfer.scheduledAt && new Date(transfer.scheduledAt).getTime() <= Date.now()) {
      execute(transfer)
    }
  }
}

function sortByDate(list: Transfer[]) {
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 220))
  processDueScheduled()
  const data = (body ?? {}) as Record<string, never>
  let match: RegExpMatchArray | null

  if (path === '/api/persons' && method === 'GET') return persons.map(toPerson) as T
  if (path === '/api/persons' && method === 'POST') {
    const person = { ...emptyPerson, ...(data as object), id: nextPersonId++ } as Omit<Person, 'accountId'>
    persons = [...persons, person]
    return toPerson(person) as T
  }
  if ((match = path.match(/^\/api\/persons\/(\d+)$/))) {
    const id = Number(match[1])
    const person = persons.find((p) => p.id === id) ?? fail(404, 'Pessoa não encontrada.')
    if (method === 'GET') return toPerson(person) as T
    if (method === 'PUT') {
      Object.assign(person, data)
      return toPerson(person) as T
    }
    if (method === 'DELETE') {
      if (accounts.some((a) => a.personId === id)) fail(409, 'Não é possível excluir uma pessoa com conta vinculada.')
      persons = persons.filter((p) => p.id !== id)
      return undefined as T
    }
  }

  if (path === '/api/accounts' && method === 'GET') return accounts.map(toAccount) as T
  if (path === '/api/accounts' && method === 'POST') {
    const { personId, balance, overdraftLimit, status } = data as unknown as AccountRecord & { status: number }
    if (!persons.some((p) => p.id === personId)) fail(404, 'Pessoa não encontrada.')
    if (accounts.some((a) => a.personId === personId)) fail(409, 'Esta pessoa já possui uma conta.')
    const record: AccountRecord = { id: nextAccountId++, personId, balance, overdraftLimit, status: statusNames[status] }
    accounts = [...accounts, record]
    return toAccount(record) as T
  }
  if ((match = path.match(/^\/api\/accounts\/(\d+)$/))) {
    const account = findAccount(Number(match[1]))
    if (method === 'GET') return toAccount(account) as T
    if (method === 'PUT') {
      const { personId, overdraftLimit, status } = data as unknown as { personId: number; overdraftLimit: number; status: number }
      Object.assign(account, { personId, overdraftLimit, status: statusNames[status] })
      return toAccount(account) as T
    }
    if (method === 'DELETE') {
      if (transfers.some((t) => t.sourceAccountId === account.id || t.destinationAccountId === account.id)) {
        fail(409, 'Não é possível excluir uma conta com movimentações.')
      }
      accounts = accounts.filter((a) => a.id !== account.id)
      return undefined as T
    }
  }

  if ((path === '/api/transfers' || path === '/api/transfers/scheduled') && method === 'POST') {
    const { sourceAccountId, destinationAccountId, amount, scheduledAt } = data as unknown as {
      sourceAccountId: number
      destinationAccountId: number
      amount: number
      scheduledAt?: string
    }
    const isScheduled = path.endsWith('/scheduled')
    validateTransfer(sourceAccountId, destinationAccountId, amount)
    if (isScheduled && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) {
      fail(400, 'A data do agendamento deve ser futura.')
    }
    const transfer: Transfer = {
      id: crypto.randomUUID(),
      sourceAccountId,
      destinationAccountId,
      sourceAccountName: null,
      destinationAccountName: null,
      amount,
      status: isScheduled ? 'Scheduled' : 'Processing',
      createdAt: new Date().toISOString(),
      scheduledAt: isScheduled ? new Date(scheduledAt!).toISOString() : null,
      processedAt: null,
      cancelledAt: null,
      failureReason: null,
    }
    if (!isScheduled) execute(transfer)
    transfers = [...transfers, transfer]
    if (transfer.status === 'Failed') fail(422, transfer.failureReason ?? 'Transferência rejeitada.')
    return withNames(transfer) as T
  }
  if ((match = path.match(/^\/api\/transfers\/([\w-]+)(\/cancel)?$/))) {
    const transfer = transfers.find((t) => t.id === match![1]) ?? fail(404, 'Transferência não encontrada.')
    if (match[2] && method === 'POST') {
      if (transfer.status !== 'Scheduled') fail(422, 'Apenas transferências agendadas podem ser canceladas.')
      transfer.status = 'Cancelled'
      transfer.cancelledAt = new Date().toISOString()
    }
    return withNames(transfer) as T
  }
  if ((match = path.match(/^\/api\/transfer-history\/accounts\/(\d+)$/))) {
    const id = Number(match[1])
    findAccount(id)
    return sortByDate(transfers.filter((t) => t.sourceAccountId === id || t.destinationAccountId === id)).map(withNames) as T
  }

  return fail(404, `Rota não encontrada no modo demonstração: ${method} ${path}`)
}
