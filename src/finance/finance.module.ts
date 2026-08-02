import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { Reminder } from 'src/reminders/entities/reminder.entity';
import { FinanceBudget } from './entities/finance-budget.entity';
import { FinanceCategory } from './entities/finance-category.entity';
import { FinanceGoalContribution } from './entities/finance-goal-contribution.entity';
import { FinanceGoal } from './entities/finance-goal.entity';
import { FinanceSpaceInvite } from './entities/finance-space-invite.entity';
import { FinanceSpaceMember } from './entities/finance-space-member.entity';
import { FinanceSpace } from './entities/finance-space.entity';
import { FinanceTag } from './entities/finance-tag.entity';
import { FinanceTransactionTag } from './entities/finance-transaction-tag.entity';
import { FinanceTransaction } from './entities/finance-transaction.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceSpace,
      FinanceSpaceMember,
      FinanceSpaceInvite,
      FinanceCategory,
      FinanceTag,
      FinanceTransaction,
      FinanceTransactionTag,
      FinanceBudget,
      FinanceGoal,
      FinanceGoalContribution,
      User,
      Reminder,
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [SpacesController, FinanceController],
  providers: [SpacesService, FinanceService],
  exports: [SpacesService, FinanceService],
})
export class FinanceModule {}
