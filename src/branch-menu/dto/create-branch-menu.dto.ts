import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateBranchMenuDto {
  @ApiProperty({ description: 'Menu item ID' })
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;
}
