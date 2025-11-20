import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AttachRecipeDto {
  @ApiProperty({ description: 'Recipe ID to attach' })
  @IsString()
  @IsNotEmpty()
  recipeId!: string;
}
