export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}

export const notFound = (what = "not_found") => new HttpError(404, what);
export const forbidden = () => new HttpError(403, "forbidden");
export const unauthorized = () => new HttpError(401, "unauthorized");
export const conflict = (code: string) => new HttpError(409, code);
