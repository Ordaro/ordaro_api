import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../database/prisma.module';

import { AuthController } from './auth.controller';
import { Auth0ManagementService } from './services/auth0-management.service';
import { ClerkManagementService } from './services/clerk-management.service';
import { ClerkStrategy } from './strategies/clerk.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'clerk' }),
    PrismaModule,
    ConfigModule,
  ],
  providers: [Auth0ManagementService, ClerkStrategy, ClerkManagementService],
  controllers: [AuthController],
  exports: [ClerkManagementService, PassportModule],
})
export class AuthModule {}
