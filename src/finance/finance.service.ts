import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RealtimeEventsService } from 'src/realtime/realtime-events.service';
import { Reminder } from 'src/reminders/entities/reminder.entity';
import { In, Repository } from 'typeorm';
import {
  ContributeGoalDto,
  CreateBudgetDto,
  CreateGoalDto,
  CreateTagDto,
  CreateTransactionDto,
  UpdateBudgetDto,
  UpdateGoalDto,
  UpdateTagDto,
  UpdateTransactionDto,
} from './dto/finance.dto';
import { FinanceBudget } from './entities/finance-budget.entity';
import { FinanceCategory } from './entities/finance-category.entity';
import { FinanceGoalContribution } from './entities/finance-goal-contribution.entity';
import { FinanceGoal } from './entities/finance-goal.entity';
import { FinanceTag } from './entities/finance-tag.entity';
import { FinanceTransactionTag } from './entities/finance-transaction-tag.entity';
import { FinanceTransaction } from './entities/finance-transaction.entity';
import {
  FinanceBudgetPeriod,
  FinanceGoalStatus,
  FinanceMemberRole,
  FinanceTransactionType,
} from './finance.enums';
import { SpacesService } from './spaces.service';

export type TagView = {
  id: string;
  spaceId: string;
  name: string;
  color: string | null;
};

export type TransactionView = {
  id: string;
  spaceId: string;
  type: FinanceTransactionType;
  amount: number;
  occurredAt: string;
  categoryId: string;
  categoryName: string;
  note: string | null;
  reminderId: string | null;
  tagIds: string[];
  tags: TagView[];
  createdBy: string;
  createdAt: string;
};

export type SummaryView = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    type: FinanceTransactionType;
    total: number;
  }>;
};

export type BudgetStatusView = {
  id: string;
  year: number;
  month: number;
  amount: number;
  categoryId: string | null;
  tagId: string | null;
  label: string;
  spent: number;
  remaining: number;
  percent: number;
  overBudget: boolean;
};

export type GoalView = {
  id: string;
  spaceId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  status: FinanceGoalStatus;
  percent: number;
  createdAt: string;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly spacesService: SpacesService,
    @InjectRepository(FinanceTag)
    private readonly tagsRepo: Repository<FinanceTag>,
    @InjectRepository(FinanceCategory)
    private readonly categoriesRepo: Repository<FinanceCategory>,
    @InjectRepository(FinanceTransaction)
    private readonly transactionsRepo: Repository<FinanceTransaction>,
    @InjectRepository(FinanceTransactionTag)
    private readonly txnTagsRepo: Repository<FinanceTransactionTag>,
    @InjectRepository(FinanceBudget)
    private readonly budgetsRepo: Repository<FinanceBudget>,
    @InjectRepository(FinanceGoal)
    private readonly goalsRepo: Repository<FinanceGoal>,
    @InjectRepository(FinanceGoalContribution)
    private readonly contributionsRepo: Repository<FinanceGoalContribution>,
    @InjectRepository(Reminder)
    private readonly remindersRepo: Repository<Reminder>,
    @Inject(forwardRef(() => RealtimeEventsService))
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  private notifyFinance(spaceId: string, reason: string, actorId?: string): void {
    this.realtimeEvents.emitFinanceSync({ spaceId, reason, actorId });
  }

  // --- Tags ---

  async listTags(userId: string, spaceId: string): Promise<TagView[]> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.VIEWER,
    );
    const tags = await this.tagsRepo.find({
      where: { space_id: spaceId },
      order: { name: 'ASC' },
    });
    return tags.map((t) => this.toTagView(t));
  }

  async createTag(
    userId: string,
    spaceId: string,
    dto: CreateTagDto,
  ): Promise<TagView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    try {
      const tag = await this.tagsRepo.save(
        this.tagsRepo.create({
          space_id: spaceId,
          name: dto.name.trim(),
          color: dto.color ?? null,
        }),
      );
      this.notifyFinance(spaceId, 'finance:tag_changed', userId);
      return this.toTagView(tag);
    } catch {
      throw new ConflictException('Ya existe una etiqueta con ese nombre.');
    }
  }

  async updateTag(
    userId: string,
    spaceId: string,
    tagId: string,
    dto: UpdateTagDto,
  ): Promise<TagView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const tag = await this.findTagOrFail(spaceId, tagId);
    if (dto.name !== undefined) tag.name = dto.name.trim();
    if (dto.color !== undefined) tag.color = dto.color;
    try {
      await this.tagsRepo.save(tag);
    } catch {
      throw new ConflictException('Ya existe una etiqueta con ese nombre.');
    }
    this.notifyFinance(spaceId, 'finance:tag_changed', userId);
    return this.toTagView(tag);
  }

  async deleteTag(
    userId: string,
    spaceId: string,
    tagId: string,
  ): Promise<void> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const tag = await this.findTagOrFail(spaceId, tagId);
    await this.tagsRepo.remove(tag);
    this.notifyFinance(spaceId, 'finance:tag_changed', userId);
  }

  // --- Transactions ---

  async listTransactions(
    userId: string,
    spaceId: string,
    filters: {
      type?: FinanceTransactionType;
      categoryId?: string;
      tagId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: TransactionView[]; total: number }> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.VIEWER,
    );

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));

    const qb = this.transactionsRepo
      .createQueryBuilder('txn')
      .where('txn.space_id = :spaceId', { spaceId });

    if (filters.type) {
      qb.andWhere('txn.type = :type', { type: filters.type });
    }
    if (filters.categoryId) {
      qb.andWhere('txn.category_id = :categoryId', {
        categoryId: filters.categoryId,
      });
    }
    if (filters.from) {
      qb.andWhere('txn.occurred_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('txn.occurred_at <= :to', { to: filters.to });
    }
    if (filters.tagId) {
      qb.innerJoin(
        FinanceTransactionTag,
        'tt',
        'tt.transaction_id = txn.id AND tt.tag_id = :tagId',
        { tagId: filters.tagId },
      );
    }

    qb.orderBy('txn.occurred_at', 'DESC').addOrderBy('txn.created_at', 'DESC');

    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const items = await this.mapTransactions(rows);
    return { items, total };
  }

  async createTransaction(
    userId: string,
    spaceId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );

    const category = await this.findCategoryOrFail(spaceId, dto.categoryId);
    await this.assertReminderAccess(userId, dto.reminderId);

    const txn = await this.transactionsRepo.save(
      this.transactionsRepo.create({
        space_id: spaceId,
        created_by: userId,
        type: dto.type,
        amount: dto.amount.toFixed(2),
        occurred_at: dto.occurredAt,
        category_id: category.id,
        note: dto.note?.trim() || null,
        reminder_id: dto.reminderId ?? null,
      }),
    );

    await this.replaceTags(spaceId, txn.id, dto.tagIds ?? []);
    const [view] = await this.mapTransactions([txn]);
    this.notifyFinance(spaceId, 'finance:transaction_changed', userId);
    return view;
  }

  async updateTransaction(
    userId: string,
    spaceId: string,
    txnId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const txn = await this.findTxnOrFail(spaceId, txnId);

    if (dto.type !== undefined) txn.type = dto.type;
    if (dto.amount !== undefined) txn.amount = dto.amount.toFixed(2);
    if (dto.occurredAt !== undefined) txn.occurred_at = dto.occurredAt;
    if (dto.note !== undefined) txn.note = dto.note?.trim() || null;
    if (dto.categoryId !== undefined) {
      await this.findCategoryOrFail(spaceId, dto.categoryId);
      txn.category_id = dto.categoryId;
    }
    if (dto.reminderId !== undefined) {
      await this.assertReminderAccess(userId, dto.reminderId ?? undefined);
      txn.reminder_id = dto.reminderId;
    }

    await this.transactionsRepo.save(txn);
    if (dto.tagIds !== undefined) {
      await this.replaceTags(spaceId, txn.id, dto.tagIds);
    }

    const [view] = await this.mapTransactions([txn]);
    this.notifyFinance(spaceId, 'finance:transaction_changed', userId);
    return view;
  }

  async deleteTransaction(
    userId: string,
    spaceId: string,
    txnId: string,
  ): Promise<void> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const txn = await this.findTxnOrFail(spaceId, txnId);
    await this.transactionsRepo.remove(txn);
    this.notifyFinance(spaceId, 'finance:transaction_changed', userId);
  }

  async getSummary(
    userId: string,
    spaceId: string,
    from?: string,
    to?: string,
  ): Promise<SummaryView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.VIEWER,
    );

    const qb = this.transactionsRepo
      .createQueryBuilder('txn')
      .leftJoin(FinanceCategory, 'cat', 'cat.id = txn.category_id')
      .select('txn.type', 'type')
      .addSelect('txn.category_id', 'categoryId')
      .addSelect('cat.name', 'categoryName')
      .addSelect('SUM(txn.amount)', 'total')
      .where('txn.space_id = :spaceId', { spaceId })
      .groupBy('txn.type')
      .addGroupBy('txn.category_id')
      .addGroupBy('cat.name');

    if (from) qb.andWhere('txn.occurred_at >= :from', { from });
    if (to) qb.andWhere('txn.occurred_at <= :to', { to });

    const rows = await qb.getRawMany<{
      type: FinanceTransactionType;
      categoryId: string;
      categoryName: string;
      total: string;
    }>();

    let totalIncome = 0;
    let totalExpense = 0;
    const byCategory = rows.map((row) => {
      const total = Number(row.total);
      if (row.type === FinanceTransactionType.INCOME) totalIncome += total;
      else totalExpense += total;
      return {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        type: row.type,
        total,
      };
    });

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byCategory,
    };
  }

  async createFromReminder(
    userId: string,
    spaceId: string,
    reminderId: string,
    overrides?: Partial<CreateTransactionDto>,
  ): Promise<TransactionView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );

    const reminder = await this.remindersRepo.findOne({
      where: { id: reminderId, user_id: userId },
    });
    if (!reminder) {
      throw new NotFoundException('Recordatorio no encontrado.');
    }

    let categoryId = overrides?.categoryId;
    if (!categoryId) {
      const pick =
        (await this.categoriesRepo
          .createQueryBuilder('c')
          .where('c.space_id = :spaceId', { spaceId })
          .andWhere('c.kind IN (:...kinds)', { kinds: ['expense', 'any'] })
          .andWhere('c.parent_id IS NOT NULL')
          .orderBy('c.name', 'ASC')
          .getOne()) ||
        (await this.categoriesRepo
          .createQueryBuilder('c')
          .where('c.space_id = :spaceId', { spaceId })
          .andWhere('c.kind IN (:...kinds)', { kinds: ['expense', 'any'] })
          .orderBy('c.name', 'ASC')
          .getOne());

      if (!pick) {
        throw new BadRequestException(
          'No hay categorías disponibles en este espacio.',
        );
      }
      categoryId = pick.id;
    }

    if (overrides?.amount === undefined) {
      throw new BadRequestException(
        'Debes indicar el monto del pago a registrar.',
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    return this.createTransaction(userId, spaceId, {
      type: overrides?.type ?? FinanceTransactionType.EXPENSE,
      amount: overrides.amount,
      occurredAt: overrides?.occurredAt ?? today,
      categoryId,
      note: overrides?.note ?? reminder.title,
      tagIds: overrides?.tagIds,
      reminderId,
    });
  }

  // --- Budgets ---

  async listBudgetStatus(
    userId: string,
    spaceId: string,
    year: number,
    month: number,
  ): Promise<BudgetStatusView[]> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.VIEWER,
    );

    const budgets = await this.budgetsRepo.find({
      where: { space_id: spaceId, year, month },
    });

    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const result: BudgetStatusView[] = [];

    for (const budget of budgets) {
      let spent = 0;
      let label = '';

      if (budget.category_id) {
        const category = await this.categoriesRepo.findOne({
          where: { id: budget.category_id },
        });
        label = category?.name ?? 'Categoría';

        const childIds = (
          await this.categoriesRepo.find({
            where: { parent_id: budget.category_id, space_id: spaceId },
          })
        ).map((c) => c.id);
        const categoryIds = [budget.category_id, ...childIds];

        const raw = await this.transactionsRepo
          .createQueryBuilder('txn')
          .select('COALESCE(SUM(txn.amount), 0)', 'spent')
          .where('txn.space_id = :spaceId', { spaceId })
          .andWhere('txn.type = :type', {
            type: FinanceTransactionType.EXPENSE,
          })
          .andWhere('txn.category_id IN (:...categoryIds)', { categoryIds })
          .andWhere('txn.occurred_at >= :from', { from })
          .andWhere('txn.occurred_at <= :to', { to })
          .getRawOne<{ spent: string }>();
        spent = Number(raw?.spent ?? 0);
      } else if (budget.tag_id) {
        const tag = await this.tagsRepo.findOne({
          where: { id: budget.tag_id },
        });
        label = tag?.name ?? 'Etiqueta';

        const raw = await this.transactionsRepo
          .createQueryBuilder('txn')
          .innerJoin(
            FinanceTransactionTag,
            'tt',
            'tt.transaction_id = txn.id AND tt.tag_id = :tagId',
            { tagId: budget.tag_id },
          )
          .select('COALESCE(SUM(txn.amount), 0)', 'spent')
          .where('txn.space_id = :spaceId', { spaceId })
          .andWhere('txn.type = :type', {
            type: FinanceTransactionType.EXPENSE,
          })
          .andWhere('txn.occurred_at >= :from', { from })
          .andWhere('txn.occurred_at <= :to', { to })
          .getRawOne<{ spent: string }>();
        spent = Number(raw?.spent ?? 0);
      }

      const amount = Number(budget.amount);
      const remaining = amount - spent;
      const percent = amount > 0 ? Math.round((spent / amount) * 100) : 0;

      result.push({
        id: budget.id,
        year: budget.year,
        month: budget.month,
        amount,
        categoryId: budget.category_id,
        tagId: budget.tag_id,
        label,
        spent,
        remaining,
        percent,
        overBudget: spent >= amount,
      });
    }

    return result;
  }

  async createBudget(
    userId: string,
    spaceId: string,
    dto: CreateBudgetDto,
  ): Promise<BudgetStatusView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );

    const hasCategory = !!dto.categoryId;
    const hasTag = !!dto.tagId;
    if (hasCategory === hasTag) {
      throw new BadRequestException(
        'Debes indicar exactamente una categoría o una etiqueta.',
      );
    }

    if (dto.categoryId) {
      await this.findCategoryOrFail(spaceId, dto.categoryId);
    }
    if (dto.tagId) {
      await this.findTagOrFail(spaceId, dto.tagId);
    }

    try {
      const budget = await this.budgetsRepo.save(
        this.budgetsRepo.create({
          space_id: spaceId,
          period: FinanceBudgetPeriod.MONTHLY,
          year: dto.year,
          month: dto.month,
          amount: dto.amount.toFixed(2),
          category_id: dto.categoryId ?? null,
          tag_id: dto.tagId ?? null,
        }),
      );

      const statuses = await this.listBudgetStatus(
        userId,
        spaceId,
        budget.year,
        budget.month,
      );
      const match = statuses.find((b) => b.id === budget.id);
      if (!match) {
        throw new NotFoundException('Presupuesto no encontrado.');
      }
      this.notifyFinance(spaceId, 'finance:budget_changed', userId);
      return match;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ConflictException(
        'Ya existe un presupuesto para ese objetivo en el período.',
      );
    }
  }

  async updateBudget(
    userId: string,
    spaceId: string,
    budgetId: string,
    dto: UpdateBudgetDto,
  ): Promise<BudgetStatusView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const budget = await this.budgetsRepo.findOne({
      where: { id: budgetId, space_id: spaceId },
    });
    if (!budget) {
      throw new NotFoundException('Presupuesto no encontrado.');
    }
    if (dto.amount !== undefined) budget.amount = dto.amount.toFixed(2);
    await this.budgetsRepo.save(budget);

    const statuses = await this.listBudgetStatus(
      userId,
      spaceId,
      budget.year,
      budget.month,
    );
    const match = statuses.find((b) => b.id === budget.id);
    if (!match) {
      throw new NotFoundException('Presupuesto no encontrado.');
    }
    this.notifyFinance(spaceId, 'finance:budget_changed', userId);
    return match;
  }

  async deleteBudget(
    userId: string,
    spaceId: string,
    budgetId: string,
  ): Promise<void> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const budget = await this.budgetsRepo.findOne({
      where: { id: budgetId, space_id: spaceId },
    });
    if (!budget) {
      throw new NotFoundException('Presupuesto no encontrado.');
    }
    await this.budgetsRepo.remove(budget);
    this.notifyFinance(spaceId, 'finance:budget_changed', userId);
  }

  // --- Goals ---

  async listGoals(userId: string, spaceId: string): Promise<GoalView[]> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.VIEWER,
    );
    const goals = await this.goalsRepo.find({
      where: { space_id: spaceId },
      order: { created_at: 'DESC' },
    });
    return goals.map((g) => this.toGoalView(g));
  }

  async createGoal(
    userId: string,
    spaceId: string,
    dto: CreateGoalDto,
  ): Promise<GoalView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const goal = await this.goalsRepo.save(
      this.goalsRepo.create({
        space_id: spaceId,
        name: dto.name.trim(),
        target_amount: dto.targetAmount.toFixed(2),
        current_amount: '0',
        deadline: dto.deadline ?? null,
        status: FinanceGoalStatus.ACTIVE,
        created_by: userId,
      }),
    );
    this.notifyFinance(spaceId, 'finance:goal_changed', userId);
    return this.toGoalView(goal);
  }

  async updateGoal(
    userId: string,
    spaceId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ): Promise<GoalView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const goal = await this.findGoalOrFail(spaceId, goalId);
    if (dto.name !== undefined) goal.name = dto.name.trim();
    if (dto.targetAmount !== undefined) {
      goal.target_amount = dto.targetAmount.toFixed(2);
    }
    if (dto.deadline !== undefined) goal.deadline = dto.deadline;
    if (dto.status !== undefined) goal.status = dto.status;
    await this.goalsRepo.save(goal);
    this.notifyFinance(spaceId, 'finance:goal_changed', userId);
    return this.toGoalView(goal);
  }

  async deleteGoal(
    userId: string,
    spaceId: string,
    goalId: string,
  ): Promise<void> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const goal = await this.findGoalOrFail(spaceId, goalId);
    await this.goalsRepo.remove(goal);
    this.notifyFinance(spaceId, 'finance:goal_changed', userId);
  }

  async contributeGoal(
    userId: string,
    spaceId: string,
    goalId: string,
    dto: ContributeGoalDto,
  ): Promise<GoalView> {
    await this.spacesService.assertMembership(
      userId,
      spaceId,
      FinanceMemberRole.EDITOR,
    );
    const goal = await this.findGoalOrFail(spaceId, goalId);
    if (goal.status === FinanceGoalStatus.ARCHIVED) {
      throw new BadRequestException('La meta está archivada.');
    }

    const occurredAt = dto.occurredAt ?? new Date().toISOString().slice(0, 10);
    await this.contributionsRepo.save(
      this.contributionsRepo.create({
        goal_id: goal.id,
        amount: dto.amount.toFixed(2),
        occurred_at: occurredAt,
        note: dto.note?.trim() || null,
        created_by: userId,
        transaction_id: null,
      }),
    );

    const current = Number(goal.current_amount) + dto.amount;
    goal.current_amount = current.toFixed(2);
    if (current >= Number(goal.target_amount)) {
      goal.status = FinanceGoalStatus.COMPLETED;
    }
    await this.goalsRepo.save(goal);
    this.notifyFinance(spaceId, 'finance:goal_changed', userId);
    return this.toGoalView(goal);
  }

  // --- helpers ---

  private async findTagOrFail(spaceId: string, tagId: string): Promise<FinanceTag> {
    const tag = await this.tagsRepo.findOne({
      where: { id: tagId, space_id: spaceId },
    });
    if (!tag) throw new NotFoundException('Etiqueta no encontrada.');
    return tag;
  }

  private async findCategoryOrFail(
    spaceId: string,
    categoryId: string,
  ): Promise<FinanceCategory> {
    const category = await this.categoriesRepo.findOne({
      where: { id: categoryId, space_id: spaceId },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada.');
    return category;
  }

  private async findTxnOrFail(
    spaceId: string,
    txnId: string,
  ): Promise<FinanceTransaction> {
    const txn = await this.transactionsRepo.findOne({
      where: { id: txnId, space_id: spaceId },
    });
    if (!txn) throw new NotFoundException('Movimiento no encontrado.');
    return txn;
  }

  private async findGoalOrFail(
    spaceId: string,
    goalId: string,
  ): Promise<FinanceGoal> {
    const goal = await this.goalsRepo.findOne({
      where: { id: goalId, space_id: spaceId },
    });
    if (!goal) throw new NotFoundException('Meta no encontrada.');
    return goal;
  }

  private async assertReminderAccess(
    userId: string,
    reminderId?: string | null,
  ): Promise<void> {
    if (!reminderId) return;
    const reminder = await this.remindersRepo.findOne({
      where: { id: reminderId, user_id: userId },
    });
    if (!reminder) {
      throw new NotFoundException('Recordatorio no encontrado.');
    }
  }

  private async replaceTags(
    spaceId: string,
    transactionId: string,
    tagIds: string[],
  ): Promise<void> {
    const unique = [...new Set(tagIds)];
    if (unique.length) {
      const tags = await this.tagsRepo.find({
        where: { space_id: spaceId, id: In(unique) },
      });
      if (tags.length !== unique.length) {
        throw new BadRequestException(
          'Una o más etiquetas no pertenecen al espacio.',
        );
      }
    }

    await this.txnTagsRepo.delete({ transaction_id: transactionId });
    if (unique.length) {
      await this.txnTagsRepo.save(
        unique.map((tagId) =>
          this.txnTagsRepo.create({
            transaction_id: transactionId,
            tag_id: tagId,
          }),
        ),
      );
    }
  }

  private async mapTransactions(
    rows: FinanceTransaction[],
  ): Promise<TransactionView[]> {
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const categoryIds = [...new Set(rows.map((r) => r.category_id))];
    const categories = await this.categoriesRepo.find({
      where: { id: In(categoryIds) },
    });
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const links = await this.txnTagsRepo.find({
      where: { transaction_id: In(ids) },
    });
    const tagIds = [...new Set(links.map((l) => l.tag_id))];
    const tags = tagIds.length
      ? await this.tagsRepo.find({ where: { id: In(tagIds) } })
      : [];
    const tagById = new Map(tags.map((t) => [t.id, t]));

    const tagsByTxn = new Map<string, TagView[]>();
    for (const link of links) {
      const tag = tagById.get(link.tag_id);
      if (!tag) continue;
      const list = tagsByTxn.get(link.transaction_id) ?? [];
      list.push(this.toTagView(tag));
      tagsByTxn.set(link.transaction_id, list);
    }

    return rows.map((txn) => {
      const txnTags = tagsByTxn.get(txn.id) ?? [];
      return {
        id: txn.id,
        spaceId: txn.space_id,
        type: txn.type,
        amount: Number(txn.amount),
        occurredAt:
          typeof txn.occurred_at === 'string'
            ? txn.occurred_at
            : String(txn.occurred_at).slice(0, 10),
        categoryId: txn.category_id,
        categoryName: categoryById.get(txn.category_id)?.name ?? '',
        note: txn.note,
        reminderId: txn.reminder_id,
        tagIds: txnTags.map((t) => t.id),
        tags: txnTags,
        createdBy: txn.created_by,
        createdAt: txn.created_at.toISOString(),
      };
    });
  }

  private toTagView(tag: FinanceTag): TagView {
    return {
      id: tag.id,
      spaceId: tag.space_id,
      name: tag.name,
      color: tag.color,
    };
  }

  private toGoalView(goal: FinanceGoal): GoalView {
    const target = Number(goal.target_amount);
    const current = Number(goal.current_amount);
    return {
      id: goal.id,
      spaceId: goal.space_id,
      name: goal.name,
      targetAmount: target,
      currentAmount: current,
      deadline: goal.deadline,
      status: goal.status,
      percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
      createdAt: goal.created_at.toISOString(),
    };
  }
}
