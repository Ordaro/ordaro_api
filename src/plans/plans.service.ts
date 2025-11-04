import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../database/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from './dto';
import { PlanInterval as PrismaPlanInterval } from '../../generated/prisma';
import { PaystackService } from '../subscriptions/paystack.service';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => PaystackService))
    private readonly paystackService: PaystackService,
  ) {}

  async create(dto: CreatePlanDto): Promise<PlanResponseDto> {
    // Check if plan with same name already exists
    const existing = await this.prismaService.plan.findFirst({
      where: { name: dto.name, isActive: true },
    });

    if (existing) {
      throw new ConflictException(`Plan with name "${dto.name}" already exists`);
    }

    try {
      // Create plan in Paystack first
      // Note: Amount must be in smallest currency unit (pesewas/kobo/cents)
      // Minimum: 200 pesewas (2 GHS) for GHS, 100 kobo (1 NGN) for NGN
      const paystackIntervalMap: Record<PrismaPlanInterval, 'daily' | 'weekly' | 'monthly' | 'annually'> = {
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        ANNUALLY: 'annually',
      };

      // Validate minimum amount based on currency
      // This is a basic check; Paystack will also validate
      if (dto.amount < 100) {
        throw new BadRequestException(
          'Amount too low. Minimum: 200 pesewas (2 GHS) for GHS, 100 kobo (1 NGN) for NGN',
        );
      }

      const paystackPlan = await this.paystackService.createPlan({
        name: dto.name,
        interval: paystackIntervalMap[dto.interval],
        amount: dto.amount,
        ...(dto.description !== undefined && { description: dto.description }),
      });

      // Create plan in database with Paystack plan code
      const plan = await this.prismaService.plan.create({
        data: {
          paystackPlanCode: paystackPlan.planCode,
          name: dto.name,
          description: dto.description ?? null,
          amount: dto.amount,
          interval: dto.interval,
          features: dto.features ? (dto.features as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      });

      this.logger.log(`Plan created: ${plan.id}`, { planId: plan.id, name: plan.name, paystackPlanCode: paystackPlan.planCode });

      return this.mapToResponse(plan);
    } catch (error) {
      this.logger.error('Failed to create plan', { dto, error });
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to create plan',
      );
    }
  }

  async findAll(query: PaginationQueryDto): Promise<PlanResponseDto[]> {
    const { limit = 20, orderBy = 'desc' } = query;

    const plans = await this.prismaService.plan.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: {
        createdAt: orderBy,
      },
    });

    return plans.map(plan => this.mapToResponse(plan));
  }

  async findOne(id: string): Promise<PlanResponseDto> {
    const plan = await this.prismaService.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return this.mapToResponse(plan);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    const existing = await this.prismaService.plan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    try {
      // Note: Paystack doesn't allow updating amount or interval after plan creation
      // Only name and description can be updated
      if (dto.name !== undefined || dto.description !== undefined) {
        const updateData: { name?: string; description?: string } = {};
        if (dto.name !== undefined) {
          updateData.name = dto.name;
        }
        if (dto.description !== undefined) {
          updateData.description = dto.description;
        }
        await this.paystackService.updatePlan(existing.paystackPlanCode, updateData);
      }

      // Check if amount or interval changed (not allowed by Paystack)
      if (dto.amount !== undefined && dto.amount !== existing.amount) {
        throw new BadRequestException(
          'Cannot update plan amount. Create a new plan instead.',
        );
      }

      if (dto.interval !== undefined && dto.interval !== existing.interval) {
        throw new BadRequestException(
          'Cannot update plan interval. Create a new plan instead.',
        );
      }

      const plan = await this.prismaService.plan.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.features !== undefined && { features: dto.features ? (dto.features as Prisma.InputJsonValue) : Prisma.DbNull }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      this.logger.log(`Plan updated: ${plan.id}`, { planId: plan.id });

      return this.mapToResponse(plan);
    } catch (error) {
      this.logger.error('Failed to update plan', { id, dto, error });
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to update plan',
      );
    }
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prismaService.plan.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await this.prismaService.subscription.count({
      where: {
        planId: id,
        status: 'ACTIVE',
      },
    });

    if (activeSubscriptions > 0) {
      throw new ConflictException(
        `Cannot deactivate plan with ${activeSubscriptions} active subscription(s)`,
      );
    }

    // Soft delete by setting isActive to false
    await this.prismaService.plan.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Plan deactivated: ${id}`, { planId: id });
  }

  private mapToResponse(plan: {
    id: string;
    paystackPlanCode: string;
    name: string;
    description: string | null;
    amount: number;
    interval: PrismaPlanInterval;
    isActive: boolean;
    features: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): PlanResponseDto {
    return {
      id: plan.id,
      paystackPlanCode: plan.paystackPlanCode,
      name: plan.name,
      ...(plan.description !== null && { description: plan.description }),
      amount: plan.amount,
      interval: plan.interval as PlanResponseDto['interval'],
      isActive: plan.isActive,
      features: (plan.features as Record<string, unknown>) ?? undefined,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}

