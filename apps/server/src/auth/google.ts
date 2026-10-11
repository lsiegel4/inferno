import { OAuth2Client, type Certificates } from "google-auth-library";

/** Verifies a Google ID token and returns the stable account id (`sub`). */
export interface IdTokenVerifier {
  verify(idToken: string): Promise<{ sub: string }>;
}

export class InvalidIdTokenError extends Error {}

const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/**
 * Google ID token verification (ADR-0010): signature against Google's published keys,
 * audience = our OAuth client id, issuer, and expiry. `getCerts` is injectable for tests.
 */
export class GoogleIdTokenVerifier implements IdTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(
    private readonly clientId: string,
    private readonly getCerts: () => Promise<Certificates> = async () =>
      (await this.client.getFederatedSignonCertsAsync()).certs,
  ) {}

  async verify(idToken: string): Promise<{ sub: string }> {
    try {
      const certs = await this.getCerts();
      const ticket = await this.client.verifySignedJwtWithCertsAsync(
        idToken,
        certs,
        this.clientId,
        GOOGLE_ISSUERS,
      );
      const sub = ticket.getPayload()?.sub;
      if (!sub) throw new InvalidIdTokenError("token has no subject");
      return { sub };
    } catch (e) {
      throw e instanceof InvalidIdTokenError ? e : new InvalidIdTokenError(String(e));
    }
  }
}
