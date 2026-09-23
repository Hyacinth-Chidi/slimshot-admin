export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  traceId: string;
}

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorBody };
