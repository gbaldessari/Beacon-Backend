import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inbox in-app, suscripciones Web Push y entregas idempotentes.
 */
export class CreateNotificationsTables1753757500000
  implements MigrationInterface
{
  name = 'CreateNotificationsTables1753757500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        type varchar(40) NOT NULL,
        title varchar(200) NOT NULL,
        body varchar(1000) NOT NULL,
        link varchar(500) NULL,
        payload jsonb NULL,
        read_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_notifications_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_notifications_user_id
        ON notifications (user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_notifications_user_created
        ON notifications (user_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        endpoint text NOT NULL,
        p256dh varchar(255) NOT NULL,
        auth varchar(255) NOT NULL,
        user_agent varchar(500) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_push_subscriptions_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_push_subscriptions_endpoint UNIQUE (endpoint)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_push_subscriptions_user_id
        ON push_subscriptions (user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        channel varchar(20) NOT NULL,
        dedupe_key varchar(255) NOT NULL,
        status varchar(20) NOT NULL,
        error varchar(1000) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_notification_deliveries_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_notification_deliveries_dedupe UNIQUE (dedupe_key)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_notification_deliveries_user_id
        ON notification_deliveries (user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_notification_deliveries_user_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS notification_deliveries`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_push_subscriptions_user_id`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS push_subscriptions`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_notifications_user_created`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_notifications_user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
  }
}
