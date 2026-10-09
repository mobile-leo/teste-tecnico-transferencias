export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
