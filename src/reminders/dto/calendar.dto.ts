import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CalendarMemberRole } from '../calendar.enums';

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export class CreateCalendarDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(COLOR_RE)
  color?: string;
}

export class UpdateCalendarDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(COLOR_RE)
  color?: string;
}

export class CreateCalendarInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(CalendarMemberRole)
  role!: CalendarMemberRole;
}

export class UpdateCalendarMemberRoleDto {
  @IsEnum(CalendarMemberRole)
  role!: CalendarMemberRole;
}
