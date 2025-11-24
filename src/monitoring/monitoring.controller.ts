import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { ClerkGuard } from '../auth/guards/clerk.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get('invitation-stats')
  @UseGuards(ClerkGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth('Auth0')
  @ApiOperation({ summary: 'Get invitation statistics' })
  @ApiResponse({
    status: 200,
    description: 'Invitation statistics retrieved successfully',
    schema: {
      example: {
        summary: {
          pending: 5,
          accepted: 12,
          expired: 2,
          revoked: 1,
          total: 20,
        },
        recentAccepted: [
          {
            email: 'user@example.com',
            role: 'WAITER',
            acceptedAt: '2024-01-15T10:30:00Z',
          },
        ],
      },
    },
  })
  async getInvitationStats() {
    const [pending, accepted, expired, revoked] = await Promise.all([
      this.prismaService.invitation.count({ where: { status: 'PENDING' } }),
      this.prismaService.invitation.count({ where: { status: 'ACCEPTED' } }),
      this.prismaService.invitation.count({ where: { status: 'EXPIRED' } }),
      this.prismaService.invitation.count({ where: { status: 'REVOKED' } }),
    ]);

    const recentAccepted = await this.prismaService.invitation.findMany({
      where: {
        status: 'ACCEPTED',
        acceptedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        email: true,
        role: true,
        acceptedAt: true,
      },
      orderBy: { acceptedAt: 'desc' },
      take: 10,
    });

    return {
      summary: {
        pending,
        accepted,
        expired,
        revoked,
        total: pending + accepted + expired + revoked,
      },
      recentAccepted,
    };
  }
}
