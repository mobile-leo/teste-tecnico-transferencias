import type {
  Account,
  CreateAccountPayload,
  CreateTransferPayload,
  Person,
  PersonPayload,
  ProblemDetails,
  ScheduleTransferPayload,
  Transfer,
  UpdateAccountPayload,
} from './types'
import { mockRequest } from './mock'
import { ApiError } from './errors'

export { ApiError, getErrorMessage } from './errors'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
export const IS_MOCK = import.meta.env.VITE_API_MOCK === 'true'

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  if (IS_MOCK) {
    return mockRequest<T>(method, path, body)
  }

  const headers: Record<string, string> = { ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, null, 'Não foi possível conectar ao backend. Verifique se a API está em execução.')
  }

  const text = await response.text()
  const data = text ? parseJson(text) : null

  if (!response.ok) {
    throw new ApiError(response.status, data, extractErrorMessage(response.status, data))
  }

  return data as T
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function extractErrorMessage(status: number, data: unknown): string {
  if (typeof data === 'string' && data.trim()) {
    return data.trim()
  }

  if (typeof data === 'object' && data !== null) {
    const problem = data as ProblemDetails

    if (problem.message?.trim()) return problem.message.trim()

    if (problem.errors) {
      for (const messages of Object.values(problem.errors)) {
        if (Array.isArray(messages) && typeof messages[0] === 'string') return messages[0]
      }
    }

    if (problem.detail?.trim()) return problem.detail.trim()
    if (problem.title?.trim()) return problem.title.trim()
  }

  const byStatus: Record<number, string> = {
    400: 'Os dados informados são inválidos. Verifique os campos e tente novamente.',
    404: 'O registro solicitado não foi encontrado.',
    409: 'A operação não pôde ser realizada devido a um conflito.',
    422: 'A operação não atende às regras de negócio.',
    500: 'O servidor encontrou um erro interno. Tente novamente mais tarde.',
  }

  return byStatus[status] ?? `Não foi possível concluir a operação (${status}).`
}

export const api = {
  listPersons: () => request<Person[]>('GET', '/api/persons'),
  createPerson: (payload: PersonPayload) => request<Person>('POST', '/api/persons', payload),
  updatePerson: (id: number, payload: PersonPayload) => request<Person>('PUT', `/api/persons/${id}`, payload),
  deletePerson: (id: number) => request<void>('DELETE', `/api/persons/${id}`),

  listAccounts: () => request<Account[]>('GET', '/api/accounts'),
  getAccount: (id: number) => request<Account>('GET', `/api/accounts/${id}`),
  createAccount: (payload: CreateAccountPayload) => request<Account>('POST', '/api/accounts', payload),
  updateAccount: (id: number, payload: UpdateAccountPayload) =>
    request<Account>('PUT', `/api/accounts/${id}`, payload),
  deleteAccount: (id: number) => request<void>('DELETE', `/api/accounts/${id}`),

  transfer: (payload: CreateTransferPayload, idempotencyKey: string) =>
    request<Transfer>('POST', '/api/transfers', payload, { 'Idempotency-Key': idempotencyKey }),
  scheduleTransfer: (payload: ScheduleTransferPayload, idempotencyKey: string) =>
    request<Transfer>('POST', '/api/transfers/scheduled', payload, { 'Idempotency-Key': idempotencyKey }),
  getTransfer: (id: string) => request<Transfer>('GET', `/api/transfers/${id}`),
  cancelTransfer: (id: string) => request<Transfer>('POST', `/api/transfers/${id}/cancel`, {}),
  getTransferHistory: (accountId: number) =>
    request<Transfer[]>('GET', `/api/transfer-history/accounts/${accountId}`),
}
