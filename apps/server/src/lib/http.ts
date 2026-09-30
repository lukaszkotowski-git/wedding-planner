export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

export const notFound = (what = "not_found") => new HttpError(404, what);
export const forbidden = () => new HttpError(403, "forbidden");
export const unauthorized = () => new HttpError(401, "unauthorized");
export const conflict = (code: string) => new HttpError(409, code);
export const gone = (code: string) => new HttpError(410, code);
export const badRequest = (code: string, details?: Record<string, unknown>) => new HttpError(400, code, details);
/** Przekroczony limit pakietu lub funkcja niedostępna w pakiecie. */
export const paymentRequired = (code: "plan_limit" | "feature_unavailable", details: Record<string, unknown>) =>
  new HttpError(402, code, details);

/** Parametr trasy jako string (w routerach z mergeParams Express typuje je luźno). */
export function param(req: { params: Record<string, unknown> }, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string" || !v) throw notFound();
  return v;
}
