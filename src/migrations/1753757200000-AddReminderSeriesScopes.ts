import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Series recurrence scopes: until, overrides, exceptions (Google Calendar-like).
 */
export class AddReminderSeriesScopes1753757200000
  implements MigrationInterface
{
  name = 'AddReminderSeriesScopes1753757200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reminders
        ADD COLUMN IF NOT EXISTS series_id uuid NULL,
        ADD COLUMN IF NOT EXISTS series_start date NULL,
        ADD COLUMN IF NOT EXISTS series_until date NULL,
        ADD COLUMN IF NOT EXISTS original_occurrence_date date NULL,
        ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminders_series_id
        ON reminders (series_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminders_is_override
        ON reminders (is_override)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_reminders_series_id'
        ) THEN
          ALTER TABLE reminders
            ADD CONSTRAINT fk_reminders_series_id
            FOREIGN KEY (series_id) REFERENCES reminders(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reminder_exceptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reminder_id uuid NOT NULL,
        user_id uuid NOT NULL,
        occurrence_date date NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_reminder_exceptions_reminder
          FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE,
        CONSTRAINT uq_reminder_exceptions_date
          UNIQUE (reminder_id, occurrence_date)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminder_exceptions_reminder_id
        ON reminder_exceptions (reminder_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminder_exceptions_user_id
        ON reminder_exceptions (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_reminder_exceptions_user_id`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_reminder_exceptions_reminder_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS reminder_exceptions`);

    await queryRunner.query(`
      ALTER TABLE reminders DROP CONSTRAINT IF EXISTS fk_reminders_series_id
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_reminders_is_override`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_reminders_series_id`);
    await queryRunner.query(`
      ALTER TABLE reminders
        DROP COLUMN IF EXISTS is_override,
        DROP COLUMN IF EXISTS original_occurrence_date,
        DROP COLUMN IF EXISTS series_until,
        DROP COLUMN IF EXISTS series_start,
        DROP COLUMN IF EXISTS series_id
    `);
  }
}
