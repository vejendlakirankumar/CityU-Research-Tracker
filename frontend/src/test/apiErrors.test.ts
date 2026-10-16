import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getApiErrorMessage } from '../lib/apiErrors'

function responseError(data: unknown, status = 422) {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    data, status, statusText: 'Error', headers: {}, config: { headers: new AxiosHeaders() },
  })
}

describe('getApiErrorMessage', () => {
  it('shows field-level validation details and the affected filename, not the generic summary', () => {
    const file = new File(['pdf'], 'Chapter 3.pdf')
    const message = getApiErrorMessage(responseError({
      message: 'Validation failed.',
      errors: { 'annotated_documents.0': ['The server could not receive this file.'] },
      request_id: 'test-reference',
    }), 'Upload failed.', [file])
    expect(message).toContain('"Chapter 3.pdf": The server could not receive this file.')
    expect(message).toContain('Reference: test-reference')
    expect(message).not.toContain('Validation failed.')
  })

  it('handles an HTML proxy rejection without displaying HTML', () => {
    const message = getApiErrorMessage(responseError('<html>413</html>', 413), 'Upload failed.')
    expect(message).toContain('server request-size limit')
    expect(message).not.toContain('<html>')
  })

  it('identifies files rejected from the Documents tab', () => {
    const file = new File(['pdf'], 'Version.pdf')
    expect(getApiErrorMessage(responseError({
      errors: { 'files.0': ['Document exceeds the category limit.'] },
    }), 'Upload failed.', [file])).toBe('"Version.pdf": Document exceeds the category limit.')
  })

  it('explains network failures', () => {
    expect(getApiErrorMessage(new AxiosError('Network Error'), 'Upload failed.')).toContain('Check your connection')
  })

  it('uses the fallback for malformed validation data', () => {
    expect(getApiErrorMessage(responseError({ message: 'Validation failed.', errors: { file: [12, null] } }), 'Upload failed.'))
      .toBe('Upload failed.')
  })

  it('preserves explicit authorization and workflow errors', () => {
    expect(getApiErrorMessage(responseError({ message: 'This submission has been finalized.' }, 403), 'Failed.'))
      .toBe('This submission has been finalized.')
  })
})
