export interface Person {
  id: number
  name: string | null
  document: string | null
  birthDate: string | null
  email: string | null
  phone: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  accountId: number | null
}

export type PersonPayload = Omit<Person, 'id' | 'accountId'>

export enum AccountStatus {
  Active = 1,
  Blocked = 2,
  Inactive = 3,
}

export type AccountStatusName = 'Active' | 'Blocked' | 'Inactive'

export interface Account {
  id: number
  personId: number
  personName: string | null
  balance: number
  overdraftLimit: number
  availableBalance: number
  status: AccountStatusName | string | null
}

export interface CreateAccountPayload {
  personId: number
  balance: number
  overdraftLimit: number
  status: AccountStatus
}

export interface UpdateAccountPayload {
  personId: number
  overdraftLimit: number
  status: AccountStatus
}

export interface CreateTransferPayload {
  sourceAccountId: number
  destinationAccountId: number
  amount: number
}

export interface ScheduleTransferPayload extends CreateTransferPayload {
  scheduledAt: string
}

export type TransferStatus = 'Scheduled' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled'

export interface Transfer {
  id: string
  sourceAccountId: number
  destinationAccountId: number
  sourceAccountName: string | null
  destinationAccountName: string | null
  amount: number
  status: TransferStatus | string | null
  createdAt: string
  scheduledAt: string | null
  processedAt: string | null
  cancelledAt: string | null
  failureReason: string | null
}

export interface ProblemDetails {
  type?: string | null
  title?: string | null
  status?: number | null
  statusCode?: number | null
  detail?: string | null
  message?: string | null
  errors?: Record<string, string[]>
}
