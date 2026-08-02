export enum FinanceSpaceType {
  PERSONAL = 'personal',
  HOUSEHOLD = 'household',
}

export enum FinanceMemberRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum FinanceInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum FinanceCategoryKind {
  INCOME = 'income',
  EXPENSE = 'expense',
  ANY = 'any',
}

export enum FinanceTransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum FinanceBudgetPeriod {
  MONTHLY = 'monthly',
}

export enum FinanceGoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}
