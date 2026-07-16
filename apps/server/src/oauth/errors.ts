export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "unsupported_grant_type";

export class OAuthProtocolError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "OAuthProtocolError";
  }
}
