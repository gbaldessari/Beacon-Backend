import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  FinanceCategoryKind,
  FinanceGoalStatus,
  FinanceMemberRole,
  FinanceTransactionType,
} from '../finance.enums';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export class CreateHouseholdSpaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsEnum(FinanceMemberRole)
  role!: FinanceMemberRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(FinanceMemberRole)
  role!: FinanceMemberRole;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsEnum(FinanceCategoryKind)
  kind?: FinanceCategoryKind;

  @IsOptional()
  @IsString()
  @Matches(COLOR_RE)
  color?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(FinanceCategoryKind)
  kind?: FinanceCategoryKind;

  @IsOptional()
  @IsString()
  @Matches(COLOR_RE)
  color?: string | null;
}

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(COLOR_RE)
  color?: string;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(COLOR_RE)
  color?: string | null;
}

export class CreateTransactionDto {
  @IsEnum(FinanceTransactionType)
  type!: FinanceTransactionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @Matches(DATE_RE)
  occurredAt!: string;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsUUID()
  reminderId?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(FinanceTransactionType)
  type?: FinanceTransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE)
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsUUID()
  reminderId?: string | null;
}

export class CreateBudgetDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ValidateIf((dto: CreateBudgetDto) => !dto.tagId)
  @IsUUID()
  categoryId?: string;

  @ValidateIf((dto: CreateBudgetDto) => !dto.categoryId)
  @IsUUID()
  tagId?: string;
}

export class UpdateBudgetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;
}

export class CreateGoalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount!: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE)
  deadline?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE)
  deadline?: string | null;

  @IsOptional()
  @IsEnum(FinanceGoalStatus)
  status?: FinanceGoalStatus;
}

export class ContributeGoalDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE)
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FromReminderDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_RE)
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
