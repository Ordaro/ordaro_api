import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { CurrentUser, Roles, requiresOrganization } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { ClerkGuard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

import {
  CreateMenuProposalDto,
  ApproveProposalDto,
  RejectProposalDto,
} from './dto';
import { MenuProposalsService } from './menu-proposals.service';

@ApiTags('Menu Proposals')
@ApiBearerAuth('Auth0')
@Controller('menu-proposals')
@UseGuards(ClerkGuard)
export class MenuProposalsController {
  constructor(private readonly menuProposalsService: MenuProposalsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create menu proposal',
    description: 'Creates a proposal for a new menu item from a branch',
  })
  @ApiResponse({ status: 201, description: 'Proposal created successfully' })
  create(
    @Body() createMenuProposalDto: CreateMenuProposalDto,
    @CurrentUser() user: UserPayload,
    @Query('branchId') branchId: string,
  ) {
    requiresOrganization(user);
    return this.menuProposalsService.proposeMenu(
      createMenuProposalDto,
      branchId,
      user.organizationId,
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List menu proposals',
    description: 'Returns paginated list of menu proposals',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of proposals' })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query() paginationQuery?: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.menuProposalsService.listProposals(
      user.organizationId,
      status,
      branchId,
      paginationQuery,
    );
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Approve menu proposal',
    description:
      'Approves a proposal and creates the menu item. May cascade to all branches.',
  })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({ status: 200, description: 'Proposal approved successfully' })
  approve(
    @Param('id') id: string,
    @Body() approveProposalDto: ApproveProposalDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.menuProposalsService.approveProposal(
      id,
      user.clerkUserId,
      user.organizationId,
      approveProposalDto,
    );
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Reject menu proposal',
    description: 'Rejects a menu proposal with a reason',
  })
  @ApiParam({ name: 'id', description: 'Proposal UUID' })
  @ApiResponse({ status: 200, description: 'Proposal rejected successfully' })
  reject(
    @Param('id') id: string,
    @Body() rejectProposalDto: RejectProposalDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.menuProposalsService.rejectProposal(
      id,
      user.clerkUserId,
      rejectProposalDto,
      user.organizationId,
    );
  }
}
