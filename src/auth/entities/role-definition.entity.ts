import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PermissionType } from '../roles/permission-type.enum';

@Entity({ name: 'role_definitions' })
export class RoleDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({
    type: 'enum',
    enum: PermissionType,
  })
  permission_type!: PermissionType;

  @Column({ type: 'boolean', default: false })
  is_system!: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @Column({ type: 'uuid' })
  created_by!: string;
}
