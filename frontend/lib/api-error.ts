/**
 * Client-side view of an RFC 7807 problem response. `code` is an i18n key
 * under `errors.*` so the UI can show a translated message.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export function errorCode(e: unknown): string {
  if (e instanceof ApiError) return e.code;
  if (e instanceof Error && 'code' in e && typeof e.code === 'string') return e.code;
  return 'unknown';
}
