export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public issues?: Record<string, string[]>,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; issues?: Record<string, string[]> };
    throw new ApiError(res.status, body.error ?? "unknown_error", body.issues);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
