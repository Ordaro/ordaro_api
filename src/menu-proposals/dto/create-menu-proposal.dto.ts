import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateMenuProposalDto {
  @ApiProperty({ description: 'Menu item name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Menu item description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Base price' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Recipe ID to link' })
  @IsOptional()
  @IsString()
  recipeId?: string;
}
