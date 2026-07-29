import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds system roles (ADMIN, USER) and the bootstrap administrator from
 * ADMIN_INITIAL_* environment variables.
 *
 * Required env:
 * - ADMIN_INITIAL_EMAIL
 * - ADMIN_INITIAL_PASSWORD (8-16 chars, letter + number)
 * - ADMIN_INITIAL_FIRST_NAME
 * - ADMIN_INITIAL_LAST_NAME
 */
export class SeedInitialAdminUser1753756800000 implements MigrationInterface {
  name = 'SeedInitialAdminUser1753756800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    const firstName = process.env.ADMIN_INITIAL_FIRST_NAME?.trim();
    const lastName = process.env.ADMIN_INITIAL_LAST_NAME?.trim();

    if (!email || !password || !firstName || !lastName) {
      throw new Error(
        'ADMIN_INITIAL_EMAIL, ADMIN_INITIAL_PASSWORD, ADMIN_INITIAL_FIRST_NAME and ADMIN_INITIAL_LAST_NAME must be defined to seed the initial admin user',
      );
    }

    const adminId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO role_definitions (id, code, name, permission_type, is_system, created_by)
        SELECT $1, 'ADMIN', 'Administrador', 'ADMIN', true, $2
        WHERE NOT EXISTS (
          SELECT 1 FROM role_definitions WHERE code = 'ADMIN'
        )
      `,
      [randomUUID(), adminId],
    );

    await queryRunner.query(
      `
        INSERT INTO role_definitions (id, code, name, permission_type, is_system, created_by)
        SELECT $1, 'USER', 'Usuario', 'USER', true, $2
        WHERE NOT EXISTS (
          SELECT 1 FROM role_definitions WHERE code = 'USER'
        )
      `,
      [randomUUID(), adminId],
    );

    const existingUsers: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );

    if (existingUsers.length > 0) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await queryRunner.query(
      `
        INSERT INTO users (
          id,
          first_name,
          last_name,
          email,
          is_active,
          role,
          password_hash,
          created_by
        ) VALUES ($1, $2, $3, $4, true, 'ADMIN', $5, $1)
      `,
      [adminId, firstName, lastName, email, passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_INITIAL_EMAIL?.trim().toLowerCase();
    if (!email) {
      return;
    }

    await queryRunner.query(
      `DELETE FROM users WHERE lower(email) = $1 AND role = 'ADMIN'`,
      [email],
    );
  }
}
