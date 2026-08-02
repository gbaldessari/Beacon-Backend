import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tablas del módulo de finanzas personales / compartidas.
 */
export class CreateFinanceTables1753757300000 implements MigrationInterface {
  name = 'CreateFinanceTables1753757300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_spaces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        type varchar(20) NOT NULL,
        created_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_spaces_created_by
        ON finance_spaces (created_by)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_space_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_space_members_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE,
        CONSTRAINT uq_finance_space_members_space_user UNIQUE (space_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_space_members_user_id
        ON finance_space_members (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_space_invites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        email varchar(255) NOT NULL,
        token varchar(64) NOT NULL,
        role varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        invited_by uuid NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_space_invites_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE,
        CONSTRAINT uq_finance_space_invites_token UNIQUE (token)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_space_invites_space_id
        ON finance_space_invites (space_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_space_invites_email
        ON finance_space_invites (email)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        parent_id uuid NULL,
        name varchar(80) NOT NULL,
        kind varchar(20) NOT NULL DEFAULT 'any',
        color varchar(20) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_categories_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE,
        CONSTRAINT fk_finance_categories_parent
          FOREIGN KEY (parent_id) REFERENCES finance_categories(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_categories_space_parent_name
        ON finance_categories (space_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'), lower(name))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_categories_space_id
        ON finance_categories (space_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        name varchar(80) NOT NULL,
        color varchar(20) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_tags_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_tags_space_name
        ON finance_tags (space_id, lower(name))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_tags_space_id
        ON finance_tags (space_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        created_by uuid NOT NULL,
        type varchar(20) NOT NULL,
        amount numeric(14, 2) NOT NULL,
        occurred_at date NOT NULL,
        category_id uuid NOT NULL,
        note varchar(500) NULL,
        reminder_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_transactions_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE,
        CONSTRAINT fk_finance_transactions_category
          FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE RESTRICT,
        CONSTRAINT chk_finance_transactions_amount CHECK (amount > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_transactions_space_id
        ON finance_transactions (space_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_transactions_occurred_at
        ON finance_transactions (occurred_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_transactions_reminder_id
        ON finance_transactions (reminder_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_transaction_tags (
        transaction_id uuid NOT NULL,
        tag_id uuid NOT NULL,
        PRIMARY KEY (transaction_id, tag_id),
        CONSTRAINT fk_finance_txn_tags_txn
          FOREIGN KEY (transaction_id) REFERENCES finance_transactions(id) ON DELETE CASCADE,
        CONSTRAINT fk_finance_txn_tags_tag
          FOREIGN KEY (tag_id) REFERENCES finance_tags(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_budgets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        period varchar(20) NOT NULL DEFAULT 'monthly',
        year int NOT NULL,
        month int NOT NULL,
        amount numeric(14, 2) NOT NULL,
        category_id uuid NULL,
        tag_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_budgets_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE,
        CONSTRAINT fk_finance_budgets_category
          FOREIGN KEY (category_id) REFERENCES finance_categories(id) ON DELETE CASCADE,
        CONSTRAINT fk_finance_budgets_tag
          FOREIGN KEY (tag_id) REFERENCES finance_tags(id) ON DELETE CASCADE,
        CONSTRAINT chk_finance_budgets_amount CHECK (amount > 0),
        CONSTRAINT chk_finance_budgets_month CHECK (month >= 1 AND month <= 12),
        CONSTRAINT chk_finance_budgets_target CHECK (
          (category_id IS NOT NULL AND tag_id IS NULL)
          OR (category_id IS NULL AND tag_id IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_budgets_category
        ON finance_budgets (space_id, year, month, category_id)
        WHERE category_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_budgets_tag
        ON finance_budgets (space_id, year, month, tag_id)
        WHERE tag_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_goals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL,
        name varchar(120) NOT NULL,
        target_amount numeric(14, 2) NOT NULL,
        current_amount numeric(14, 2) NOT NULL DEFAULT 0,
        deadline date NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_goals_space
          FOREIGN KEY (space_id) REFERENCES finance_spaces(id) ON DELETE CASCADE,
        CONSTRAINT chk_finance_goals_target CHECK (target_amount > 0),
        CONSTRAINT chk_finance_goals_current CHECK (current_amount >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_goals_space_id
        ON finance_goals (space_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS finance_goal_contributions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        goal_id uuid NOT NULL,
        amount numeric(14, 2) NOT NULL,
        occurred_at date NOT NULL,
        note varchar(500) NULL,
        created_by uuid NOT NULL,
        transaction_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_finance_goal_contrib_goal
          FOREIGN KEY (goal_id) REFERENCES finance_goals(id) ON DELETE CASCADE,
        CONSTRAINT chk_finance_goal_contrib_amount CHECK (amount > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_finance_goal_contributions_goal_id
        ON finance_goal_contributions (goal_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS finance_goal_contributions`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_goals`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_finance_budgets_tag`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_finance_budgets_category`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_budgets`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_transaction_tags`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_transactions`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_finance_tags_space_name`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_tags`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_finance_categories_space_parent_name`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS finance_categories`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_space_invites`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_space_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS finance_spaces`);
  }
}
