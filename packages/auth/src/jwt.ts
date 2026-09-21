import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // userId
  role: string;
}

export interface JwtConfig {
  secret: string;
  issuer: string;
  ttlSeconds: number;
}

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

/** Short-lived bearer token for mobile apps / third-party integrations (section 61). Sessions (cookies) are the primary web auth. */
export async function signAccessToken(claims: { userId: string; role: string }, config: JwtConfig): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuer(config.issuer)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + config.ttlSeconds)
    .sign(key(config.secret));
}

export async function verifyAccessToken(token: string, config: JwtConfig): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(config.secret), { issuer: config.issuer });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}
