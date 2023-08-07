export type Severity = 'error' | 'warning'

export interface Diagnostic {
  code: string
  severity: Severity
  message: string
  file?: string
  loc?: { line: number; column: number }
}

export function diagnostic(partial: Diagnostic): Diagnostic {
  return partial
}

export function isError(d: Diagnostic): boolean {
  return d.severity === 'error'
}
