import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Calendarios compartidos + calendar_id en reminders + backfill.
 */
export class CreateCalendarsAndLinkReminders1753757400000
  implements MigrationInterface
{
  name = 'CreateCalendarsAndLinkReminders1753757400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendars (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        color varchar(20) NOT NULL DEFAULT '#0f766e',
        type varchar(20) NOT NULL,
        created_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_calendars_created_by
        ON calendars (created_by)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendar_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        calendar_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_calendar_members_calendar
          FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
        CONSTRAINT uq_calendar_members_calendar_user UNIQUE (calendar_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_calendar_members_user_id
        ON calendar_members (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS calendar_invites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        calendar_id uuid NOT NULL,
        email varchar(255) NOT NULL,
        token varchar(64) NOT NULL,
        role varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        invited_by uuid NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_calendar_invites_calendar
          FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
        CONSTRAINT uq_calendar_invites_token UNIQUE (token)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_calendar_invites_calendar_id
        ON calendar_invites (calendar_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_calendar_invites_email
        ON calendar_invites (email)
    `);

    await queryRunner.query(`
      ALTER TABLE reminders
        ADD COLUMN IF NOT EXISTS calendar_id uuid NULL
    `);

    // Personal calendars for every user that owns reminders or exists in users
    await queryRunner.query(`
      INSERT INTO calendars (id, name, color, type, created_by)
      SELECT gen_random_uuid(), 'Personal', '#0f766e', 'personal', u.id
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM calendar_members cm
        INNER JOIN calendars c ON c.id = cm.calendar_id
        WHERE cm.user_id = u.id AND c.type = 'personal'
      )
    `);

    await queryRunner.query(`
      INSERT INTO calendar_members (id, calendar_id, user_id, role)
      SELECT gen_random_uuid(), c.id, c.created_by, 'owner'
      FROM calendars c
      WHERE c.type = 'personal'
        AND NOT EXISTS (
          SELECT 1 FROM calendar_members cm
          WHERE cm.calendar_id = c.id AND cm.user_id = c.created_by
        )
    `);

    // Also create personal calendars for reminder owners not in users (safety)
    await queryRunner.query(`
      INSERT INTO calendars (id, name, color, type, created_by)
      SELECT gen_random_uuid(), 'Personal', '#0f766e', 'personal', r.user_id
      FROM (SELECT DISTINCT user_id FROM reminders) r
      WHERE NOT EXISTS (
        SELECT 1 FROM calendar_members cm
        INNER JOIN calendars c ON c.id = cm.calendar_id
        WHERE cm.user_id = r.user_id AND c.type = 'personal'
      )
    `);

    await queryRunner.query(`
      INSERT INTO calendar_members (id, calendar_id, user_id, role)
      SELECT gen_random_uuid(), c.id, c.created_by, 'owner'
      FROM calendars c
      WHERE c.type = 'personal'
        AND NOT EXISTS (
          SELECT 1 FROM calendar_members cm
          WHERE cm.calendar_id = c.id AND cm.user_id = c.created_by
        )
    `);

    await queryRunner.query(`
      UPDATE reminders rem
      SET calendar_id = sub.calendar_id
      FROM (
        SELECT cm.user_id, c.id AS calendar_id
        FROM calendar_members cm
        INNER JOIN calendars c ON c.id = cm.calendar_id
        WHERE c.type = 'personal'
      ) sub
      WHERE rem.user_id = sub.user_id
        AND rem.calendar_id IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE reminders
        ALTER COLUMN calendar_id SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_reminders_calendar'
        ) THEN
          ALTER TABLE reminders
            ADD CONSTRAINT fk_reminders_calendar
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_reminders_calendar_id
        ON reminders (calendar_id)
    `);

    // Shared completions: keep newest per (reminder_id, occurrence_date)
    await queryRunner.query(`
      DELETE FROM reminder_completions rc
      USING reminder_completions newer
      WHERE rc.reminder_id = newer.reminder_id
        AND rc.occurrence_date IS NOT NULL
        AND newer.occurrence_date IS NOT NULL
        AND rc.occurrence_date = newer.occurrence_date
        AND rc.completed_at < newer.completed_at
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_completions_reminder_occurrence
        ON reminder_completions (reminder_id, occurrence_date)
        WHERE occurrence_date IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS uq_reminder_completions_reminder_occurrence`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_reminders_calendar_id`);
    await queryRunner.query(`
      ALTER TABLE reminders DROP CONSTRAINT IF EXISTS fk_reminders_calendar
    `);
    await queryRunner.query(`
      ALTER TABLE reminders DROP COLUMN IF EXISTS calendar_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS calendar_invites`);
    await queryRunner.query(`DROP TABLE IF EXISTS calendar_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS calendars`);
  }
}
