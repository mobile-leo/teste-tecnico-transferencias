import useSWR, { mutate } from 'swr'
import { api } from './api'

export const keys = {
  persons: '/api/persons',
  accounts: '/api/accounts',
  account: (id: number) => `/api/accounts/${id}`,
  history: (accountId: number) => `/api/transfer-history/accounts/${accountId}`,
  transfer: (id: string) => `/api/transfers/${id}`,
}

export const usePersons = () => useSWR(keys.persons, api.listPersons)

export const useAccounts = () => useSWR(keys.accounts, api.listAccounts)

export const useAccount = (id: number) =>
  useSWR(Number.isFinite(id) ? keys.account(id) : null, () => api.getAccount(id))

export const useTransferHistory = (accountId: number) =>
  useSWR(Number.isFinite(accountId) ? keys.history(accountId) : null, () => api.getTransferHistory(accountId))

export const useTransfer = (id: string | undefined) =>
  useSWR(id ? keys.transfer(id) : null, () => api.getTransfer(id!))

export function refreshFinancialData() {
  return mutate((key) => typeof key === 'string' && key.startsWith('/api/'))
}
