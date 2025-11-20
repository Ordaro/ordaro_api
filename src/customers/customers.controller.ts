import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
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
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  SearchCustomerDto,
  UpdateCustomerDto,
  LinkCustomerOrgDto,
  FindOrCreateCustomerDto,
  CustomerConsentDto,
  WithdrawConsentDto,
} from './dto';
import { ConsentService } from './services/consent.service';

@ApiTags('Customers')
@ApiBearerAuth('Auth0')
@Controller('customers')
@UseGuards(Auth0Guard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly consentService: ConsentService,
  ) {}

  @Post('find-or-create')
  @ApiOperation({
    summary: 'Find or create customer (POS checkout)',
    description:
      'Searches for existing customer by email/phone. Creates new customer if not found. Links to organization. Main endpoint for POS checkout flow.',
  })
  @ApiResponse({ status: 200, description: 'Customer found or created' })
  @ApiResponse({ status: 201, description: 'New customer created' })
  findOrCreate(
    @Body() findOrCreateDto: FindOrCreateCustomerDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    // Override organizationId from user context for security
    findOrCreateDto.organizationId = user.organizationId;
    return this.customersService.findOrCreateCustomer(findOrCreateDto);
  }

  @Post('search')
  @ApiOperation({
    summary: 'Search for customer',
    description: 'Searches for existing customer by email or phone number',
  })
  @ApiResponse({ status: 200, description: 'Customer found or null' })
  search(@Body() searchDto: SearchCustomerDto) {
    return this.customersService.searchCustomer(searchDto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.WAITER)
  @ApiOperation({
    summary: 'Create new customer',
    description:
      'Creates a new transaction customer. Use find-or-create for POS checkout.',
  })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.createCustomer(createCustomerDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List customers',
    description: 'Returns paginated list of customers for the organization',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of customers' })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query() paginationQuery?: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.customersService.listCustomers(
      user.organizationId,
      paginationQuery,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get customer details',
    description:
      'Retrieve customer information with organization relationships',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.customersService.getCustomerById(id, user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update customer',
    description: 'Update customer information and preferences',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.customersService.updateCustomer(
      id,
      updateCustomerDto,
      user.organizationId,
    );
  }

  @Post(':id/link-organization')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Link customer to organization',
    description:
      'Links an existing customer to an organization (or updates branch)',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer linked successfully' })
  linkOrganization(
    @Param('id') id: string,
    @Body() linkDto: LinkCustomerOrgDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    // Override organizationId from user context for security
    linkDto.organizationId = user.organizationId;
    return this.customersService.linkCustomerToOrganization(
      id,
      linkDto.organizationId,
      linkDto.branchId,
    );
  }

  @Post(':id/consent')
  @ApiOperation({
    summary: 'Record customer consent',
    description:
      'Records or updates customer consent preferences for GDPR compliance',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Consent recorded successfully' })
  recordConsent(
    @Param('id') id: string,
    @Body() consentDto: CustomerConsentDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.consentService.recordConsent(
      id,
      user.organizationId,
      consentDto,
      undefined, // TODO: Extract IP and user agent from request
    );
  }

  @Post(':id/consent/withdraw')
  @ApiOperation({
    summary: 'Withdraw customer consent',
    description: 'Withdraws consent for a specific channel or all channels',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Consent withdrawn successfully' })
  withdrawConsent(
    @Param('id') id: string,
    @Body() withdrawDto: WithdrawConsentDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.consentService.withdrawConsent(
      id,
      user.organizationId,
      withdrawDto,
    );
  }

  @Get(':id/consent')
  @ApiOperation({
    summary: 'Get consent status',
    description: 'Returns current consent status for the customer',
  })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Consent status' })
  getConsentStatus(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.consentService.getConsentStatus(id, user.organizationId);
  }
}
