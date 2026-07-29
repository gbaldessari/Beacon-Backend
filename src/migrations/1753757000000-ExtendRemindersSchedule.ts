import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extiende reminders con fecha única, horario y avisos previos.
 * Renombra recurrencia daily -> weekly.
 */
export class ExtendRemindersSchedule1753757000000 implements MigrationInterface {
  name = 'ExtendRemindersSchedule1753757000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reminders
        ADD COLUMN IF NOT EXISTS scheduled_date date NULL,
        ADD COLUMN IF NOT EXISTS time_mode varchar(20) NOT NULL DEFAULT 'all_day',
        ADD COLUMN IF NOT EXISTS start_time varchar(5) NULL,
        ADD COLUMN IF NOT EXISTS end_time varchar(5) NULL,
        ADD COLUMN IF NOT EXISTS notify_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS notify_value integer NULL,
        ADD COLUMN IF NOT EXISTS notify_unit varchar(10) NULL
    `);

    await queryRunner.query(`
      UPDATE reminders
      SET recurrence_type = 'weekly'
      WHERE recurrence_type = 'daily'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reminders
        DROP COLUMN IF EXISTS scheduled_date,
        DROP COLUMN IF EXISTS time_mode,
        DROP COLUMN IF EXISTS start_time,
        DROP COLUMN IF EXISTS end_time,
        DROP COLUMN IF EXISTS notify_enabled,
        DROP COLUMN IF EXISTS notify_value,
        DROP COLUMN IF EXISTS notify_unit
    `);
  }
}
