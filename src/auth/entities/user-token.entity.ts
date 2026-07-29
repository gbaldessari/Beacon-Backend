import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Entidad de sesión autenticada.
 *
 * Persiste sesiones activas y hashes de refresh token para permitir renovación
 * e invalidación sin almacenar tokens completos.
 */
@Entity({ name: 'user_tokens' })
@Index(['user_id', 'session_id'], { unique: true })
export class UserToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Identificador de sesión que vincula access y refresh token.
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  session_id!: string;

  /**
   * Usuario dueño de la sesión.
   */
  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  /**
   * Fecha de expiración del access token.
   */
  @Column({ type: 'timestamp with time zone' })
  access_token_expires_at!: Date;

  /**
   * Hash del refresh token usado para renovar la sesión.
   */
  @Column({ type: 'varchar', length: 255 })
  refresh_token_hash!: string;

  /**
   * Fecha de expiración del refresh token.
   */
  @Index()
  @Column({ type: 'timestamp with time zone' })
  refresh_token_expires_at!: Date;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user!: User;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
