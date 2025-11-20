import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LinkRecipeMenuDto {
  @ApiProperty({ description: 'Menu item ID to link recipe to' })
  @IsString()
  @IsNotEmpty()
  menuId!: string;
}
