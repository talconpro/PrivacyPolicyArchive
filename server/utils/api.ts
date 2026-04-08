type ApiErrorOptions = {
  statusCode: number
  code: string
  message: string
  details?: any
}

export function throwApiError(options: ApiErrorOptions): never {
  throw createError({
    statusCode: options.statusCode,
    statusMessage: options.message,
    data: {
      code: options.code,
      message: options.message,
      details: options.details
    }
  })
}
