import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import {
  ContributeGoalDto,
  CreateBudgetDto,
  CreateCategoryDto,
  CreateGoalDto,
  CreateTagDto,
  CreateTransactionDto,
  FromReminderDto,
  UpdateBudgetDto,
  UpdateCategoryDto,
  UpdateGoalDto,
  UpdateTagDto,
  UpdateTransactionDto,
} from './dto/finance.dto';
import { FinanceTransactionType } from './finance.enums';
import { FinanceService } from './finance.service';
import { SpacesService } from './spaces.service';

@Controller('finance/spaces/:spaceId')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly spacesService: SpacesService,
  ) {}

  // Categories
  @Get('categories')
  listCategories(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
  ) {
    return this.spacesService.listCategories(req.user.userId, spaceId);
  }

  @Post('categories')
  createCategory(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.spacesService.createCategory(req.user.userId, spaceId, dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.spacesService.updateCategory(
      req.user.userId,
      spaceId,
      categoryId,
      dto,
    );
  }

  @Delete('categories/:categoryId')
  deleteCategory(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.spacesService.deleteCategory(
      req.user.userId,
      spaceId,
      categoryId,
    );
  }

  // Tags
  @Get('tags')
  listTags(@Request() req, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    return this.financeService.listTags(req.user.userId, spaceId);
  }

  @Post('tags')
  createTag(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.financeService.createTag(req.user.userId, spaceId, dto);
  }

  @Patch('tags/:tagId')
  updateTag(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.financeService.updateTag(
      req.user.userId,
      spaceId,
      tagId,
      dto,
    );
  }

  @Delete('tags/:tagId')
  deleteTag(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    return this.financeService.deleteTag(req.user.userId, spaceId, tagId);
  }

  // Transactions
  @Get('transactions')
  listTransactions(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Query('type') type?: FinanceTransactionType,
    @Query('categoryId') categoryId?: string,
    @Query('tagId') tagId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.financeService.listTransactions(req.user.userId, spaceId, {
      type,
      categoryId,
      tagId,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('transactions')
  createTransaction(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.financeService.createTransaction(
      req.user.userId,
      spaceId,
      dto,
    );
  }

  @Patch('transactions/:txnId')
  updateTransaction(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.updateTransaction(
      req.user.userId,
      spaceId,
      txnId,
      dto,
    );
  }

  @Delete('transactions/:txnId')
  deleteTransaction(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
  ) {
    return this.financeService.deleteTransaction(
      req.user.userId,
      spaceId,
      txnId,
    );
  }

  @Get('summary')
  getSummary(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.financeService.getSummary(
      req.user.userId,
      spaceId,
      from,
      to,
    );
  }

  @Post('from-reminder/:reminderId')
  createFromReminder(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('reminderId', ParseUUIDPipe) reminderId: string,
    @Body() dto: FromReminderDto,
  ) {
    return this.financeService.createFromReminder(
      req.user.userId,
      spaceId,
      reminderId,
      dto,
    );
  }

  // Budgets
  @Get('budgets/status')
  listBudgetStatus(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.financeService.listBudgetStatus(
      req.user.userId,
      spaceId,
      year,
      month,
    );
  }

  @Post('budgets')
  createBudget(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.financeService.createBudget(req.user.userId, spaceId, dto);
  }

  @Patch('budgets/:budgetId')
  updateBudget(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.financeService.updateBudget(
      req.user.userId,
      spaceId,
      budgetId,
      dto,
    );
  }

  @Delete('budgets/:budgetId')
  deleteBudget(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('budgetId', ParseUUIDPipe) budgetId: string,
  ) {
    return this.financeService.deleteBudget(
      req.user.userId,
      spaceId,
      budgetId,
    );
  }

  // Goals
  @Get('goals')
  listGoals(@Request() req, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    return this.financeService.listGoals(req.user.userId, spaceId);
  }

  @Post('goals')
  createGoal(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.financeService.createGoal(req.user.userId, spaceId, dto);
  }

  @Patch('goals/:goalId')
  updateGoal(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.financeService.updateGoal(
      req.user.userId,
      spaceId,
      goalId,
      dto,
    );
  }

  @Delete('goals/:goalId')
  deleteGoal(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
  ) {
    return this.financeService.deleteGoal(req.user.userId, spaceId, goalId);
  }

  @Post('goals/:goalId/contribute')
  contributeGoal(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: ContributeGoalDto,
  ) {
    return this.financeService.contributeGoal(
      req.user.userId,
      spaceId,
      goalId,
      dto,
    );
  }
}
