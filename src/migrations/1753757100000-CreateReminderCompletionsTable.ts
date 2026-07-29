import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historial de completados de recordatorios.
 */
export class CreateReminderCompletionsTable1753757100000
  implements MigrationInterface
{
  name = 'CreateReminderCompletionsTable1753757100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reminder_completions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        reminder_id uuid NOT NULL,
        user_id uuid NOT NULL,
        completed_at timestamptz NOT NULL DEFAULT now(),
        occurrence_date date NULL,
        CONSTRAINT fk_reminder_completions_reminder
          FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminder_completions_reminder_id
        ON reminder_completions (reminder_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminder_completions_user_id
        ON reminder_completions (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_reminder_completions_user_id`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_reminder_completions_reminder_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS reminder_completions`);
  }
}
