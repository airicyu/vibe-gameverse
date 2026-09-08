export class HttpError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : "error");
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}
