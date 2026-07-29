import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserToken } from './user-token.entity';

/**
 * Entidad de usuario del sistema.
 *
 * Contiene datos personales, credenciales, estado de activación, rol y sesiones
 * asociadas para autenticación.
 */
@Entity({ name: 'users' })
export class User {
  /**
   * Identificador único del usuario.
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  /**
   * Nombre del usuario.
   */
  @Column({ type: 'varchar', length: 120 })
  first_name!: string;
  /**
   * Apellido del usuario.
   */
  @Column({ type: 'varchar', length: 120 })
  last_name!: string;
  /**
   * Correo electrónico único usado para login y notificaciones.
   */
  @Column({ type: 'varchar', length: 180, unique: true })
  email!: string;
  /**
   * Indica si la cuenta fue activada por un administrador.
   */
  @Column({ type: 'boolean', default: false })
  is_active!: boolean;
  /**
   * Business role code used for access control.
   */
  @Column({ type: 'varchar', length: 64 })
  role!: string;
  /**
   * Hash de contraseña usado para autenticación.
   */
  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;
  /**
   * Código temporal para restablecer contraseña.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  recovery_code!: string | null;
  /**
   * Fecha de expiración del código de recuperación.
   */
  @Column({ type: 'timestamp with time zone', nullable: true })
  recovery_code_expires_at!: Date | null;
  /**
   * Intentos fallidos acumulados para el código de recuperación vigente.
   */
  @Column({ type: 'integer', default: 0 })
  recovery_attempts!: number;
  /**
   * Fecha de creación del usuario.
   */
  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
  /**
   * Usuario administrador que creó el registro.
   */
  @Column({ type: 'uuid' })
  created_by!: string;

  @OneToMany(() => UserToken, (session) => session.user)
  sessions!: UserToken[];
}
