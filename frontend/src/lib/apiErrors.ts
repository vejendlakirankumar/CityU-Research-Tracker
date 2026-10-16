import { isAxiosError } from 'axios'

export function getApiErrorMessage(error: unknown, fallback: string, files: File[] = []): string {
  if (!isAxiosError<unknown>(error)) return fallback
  if (!error.response) return `${fallback} The server could not be reached. Check your connection before retrying.`

  const data = error.response.data
  let message = error.response.status === 413
    ? 'The upload exceeds the server request-size limit. Upload fewer files at a time, or contact an administrator to check proxy and PHP-FPM limits.'
    : fallback

  if (typeof data !== 'object' || data === null) return message
  const body = data as Record<string, unknown>
  const details: string[] = []
  if (typeof body.errors === 'object' && body.errors !== null) {
    for (const [field, value] of Object.entries(body.errors)) {
      const match = /^(?:annotated_documents|files)\.(\d+)$/.exec(field)
      const file = match ? files[Number(match[1])] : undefined
      const messages = Array.isArray(value) ? value : [value]
      for (const detail of messages) {
        if (typeof detail === 'string') details.push(file ? `"${file.name}": ${detail}` : detail)
      }
    }
  }
  if (details.length) message = [...new Set(details)].join(' ')
  else if (typeof body.message === 'string' && body.message !== 'Validation failed.') message = body.message
  if (typeof body.request_id === 'string') message += ` Reference: ${body.request_id}.`
  return message
}
