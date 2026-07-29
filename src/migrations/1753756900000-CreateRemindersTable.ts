import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla de recordatorios/tareas recurrentes por usuario.
 */
export class CreateRemindersTable1753756900000 implements MigrationInterface {
  name = 'CreateRemindersTable1753756900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        title varchar(160) NOT NULL,
        description varchar(500) NULL,
        recurrence_type varchar(20) NOT NULL,
        weekdays smallint[] NULL,
        day_of_month smallint NULL,
        month_of_year smallint NULL,
        last_completed_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminders_user_id ON reminders (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_reminders_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS reminders`);
  }
}
