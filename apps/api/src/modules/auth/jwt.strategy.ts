import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface JwkKey {
  kid: string;
  alg: string;
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
}

// In-memory cache for Supabase public keys (kid -> PEM)
const jwksCache = new Map<string, string>();

// Seed with current project key if known to avoid cold-start network stalls
jwksCache.set(
  'f670b5e7-ee33-4f6a-9fd3-c302756c038c',
  '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1RrWrsws8Qt3FOKNa7TYUlOXeri2\neh65WPkKuZfy5LYOSMXdlgOGIaajHHTECAiM2XTeRRghFpv66DWgAPJgyg==\n-----END PUBLIC KEY-----\n'
);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256', 'ES256', 'RS256'],
      secretOrKeyProvider: async (
        _request: any,
        rawJwtToken: string,
        done: (err: any, secretOrKey?: string) => void
      ) => {
        try {
          if (!rawJwtToken) {
            return done(new UnauthorizedException('Missing token'));
          }

          const parts = rawJwtToken.split('.');
          if (parts.length < 2) {
            return done(new UnauthorizedException('Malformed token'));
          }

          const headerJson = Buffer.from(parts[0], 'base64').toString('utf8');
          const header = JSON.parse(headerJson);

          if (header.alg === 'ES256' || header.alg === 'RS256') {
            const kid = header.kid;
            if (kid && jwksCache.has(kid)) {
              return done(null, jwksCache.get(kid));
            }

            // Fetch dynamic JWKS from Supabase
            const supabaseUrl =
              process.env.NEXT_PUBLIC_SUPABASE_URL ||
              'https://nveiemzexhiypnkwzpwk.supabase.co';
            const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;

            try {
              const res = await fetch(jwksUrl);
              if (res.ok) {
                const data = await res.json();
                const matchedKey = (data.keys as JwkKey[])?.find(
                  (k) => !kid || k.kid === kid
                );
                if (matchedKey) {
                  const keyObject = crypto.createPublicKey({
                    key: matchedKey as any,
                    format: 'jwk',
                  });
                  const pem = keyObject.export({
                    type: 'spki',
                    format: 'pem',
                  }) as string;
                  if (matchedKey.kid) {
                    jwksCache.set(matchedKey.kid, pem);
                  }
                  return done(null, pem);
                }
              }
            } catch {
              // Network fallback: continue to secret
            }
          }

          // Fallback to symmetric secret for HS256 / tests
          const secret =
            process.env.SUPABASE_JWT_SECRET ||
            'dev-supabase-jwt-secret-placeholder-for-testing';
          return done(null, secret);
        } catch (err) {
          return done(err);
        }
      },
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or missing token payload');
    }
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
