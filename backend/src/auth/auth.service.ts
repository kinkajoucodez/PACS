import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find or create a user based on Keycloak JWT payload
   */
  async findOrCreateUser(keycloakUser: {
    sub: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
  }) {
    // Map Keycloak roles to our user roles
    const role = this.mapKeycloakRole(keycloakUser.roles);

    // Try to find existing user by email
    let user = await this.prisma.user.findUnique({
      where: { email: keycloakUser.email },
      include: {
        radiologistProfile: true,
      },
    });

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: keycloakUser.email,
          firstName: keycloakUser.firstName || keycloakUser.username,
          lastName: keycloakUser.lastName || '',
          role: role,
          status: 'active',
        },
        include: {
          radiologistProfile: true,
        },
      });
    }

    return user;
  }

  private mapKeycloakRole(
    keycloakRoles: string[],
  ):
    | 'admin'
    | 'radiologist'
    | 'provider_manager'
    | 'billing_officer'
    | 'support'
    | 'auditor' {
    // Priority mapping: admin > radiologist > provider_manager > billing_officer > auditor > support
    if (keycloakRoles.includes('admin')) return 'admin';
    if (keycloakRoles.includes('radiologist')) return 'radiologist';
    if (
      keycloakRoles.includes('provider_manager') ||
      keycloakRoles.includes('provider')
    )
      return 'provider_manager';
    if (
      keycloakRoles.includes('billing_officer') ||
      keycloakRoles.includes('billing')
    )
      return 'billing_officer';
    if (keycloakRoles.includes('auditor')) return 'auditor';
    return 'support'; // Default role
  }
}
