import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notas personales tipo Keep: notas, checklist, etiquetas.
 */
export class CreateNotesTables1753757600000 implements MigrationInterface {
  name = 'CreateNotesTables1753757600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        title varchar(200) NOT NULL DEFAULT '',
        body text NOT NULL DEFAULT '',
        color varchar(32) NOT NULL DEFAULT '#fff9c4',
        pinned boolean NOT NULL DEFAULT false,
        archived boolean NOT NULL DEFAULT false,
        is_checklist boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_notes_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_notes_user_id ON notes (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_notes_user_archived_pinned
        ON notes (user_id, archived, pinned, position)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS note_checklist_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        note_id uuid NOT NULL,
        text varchar(500) NOT NULL,
        done boolean NOT NULL DEFAULT false,
        position integer NOT NULL DEFAULT 0,
        CONSTRAINT fk_note_checklist_items_note
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_note_checklist_items_note_id
        ON note_checklist_items (note_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS note_labels (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        name varchar(80) NOT NULL,
        color varchar(32) NOT NULL DEFAULT '#94a3b8',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_note_labels_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_note_labels_user_name UNIQUE (user_id, name)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_note_labels_user_id
        ON note_labels (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS note_label_links (
        note_id uuid NOT NULL,
        label_id uuid NOT NULL,
        PRIMARY KEY (note_id, label_id),
        CONSTRAINT fk_note_label_links_note
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        CONSTRAINT fk_note_label_links_label
          FOREIGN KEY (label_id) REFERENCES note_labels(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS note_label_links`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_note_labels_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS note_labels`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_note_checklist_items_note_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS note_checklist_items`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_notes_user_archived_pinned`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_notes_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS notes`);
  }
}
