import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as jwksRsa from 'jwks-rsa';

export interface JwtPayload {
  sub: string;
  email: string;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const jwksUri = configService.get<string>('KEYCLOAK_JWKS_URI');
    const clientId = configService.get<string>('KEYCLOAK_CLIENT_ID');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri:
          jwksUri ||
          'http://localhost:8080/realms/pacs/protocol/openid-connect/certs',
      }),
      algorithms: ['RS256'],
      audience: clientId || 'pacs-viewer',
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Extract roles from realm_access and resource_access
    const realmRoles = payload.realm_access?.roles || [];
    const clientId =
      this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'pacs-viewer';
    const clientRoles = payload.resource_access?.[clientId]?.roles || [];
    const roles = [...new Set([...realmRoles, ...clientRoles])];

    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles,
    };
  }
}
