export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, unknown> & { issues?: Record<string, string[]> },
  ) {
    super(code);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
    const { error, ...details } = body;
    throw new ApiError(res.status, error ?? "unknown_error", details);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...rest,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    headers: { "Content-Type": "application/json", ...rest.headers },
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", credentials: "include", body: form });
  return handle<T>(res);
}
