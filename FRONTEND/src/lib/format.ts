import { AccountStatus } from './types'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export const formatCurrency = (value: number) => currency.format(value)

export const formatDateTime = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : '—')

export const formatAccountNumber = (id: number) => id.toString().padStart(5, '0')

export function parseAmount(input: string): number {
  const normalized = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN
}

export const accountStatusLabel: Record<string, string> = {
  Active: 'Ativa',
  Blocked: 'Bloqueada',
  Inactive: 'Inativa',
}

export const accountStatusFromName: Record<string, AccountStatus> = {
  Active: AccountStatus.Active,
  Blocked: AccountStatus.Blocked,
  Inactive: AccountStatus.Inactive,
}

export const transferStatusLabel: Record<string, string> = {
  Scheduled: 'Agendada',
  Processing: 'Processando',
  Completed: 'Concluída',
  Failed: 'Falhou',
  Cancelled: 'Cancelada',
}

export function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
