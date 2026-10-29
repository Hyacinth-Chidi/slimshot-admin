export interface ApiErrorBody {
  code: string;
  message: string;
  /** Shape varies: a class-validator 422 sends string[] (see lib/api/field-errors.ts), a P2002 409 the unique target. */
  details?: unknown;
  traceId: string;
}

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorBody };

/** How the server names an admin: who set a price, who changed a setting, who did something. */
export interface AdminRef {
  id: string;
  email: string;
  name: string;
}
