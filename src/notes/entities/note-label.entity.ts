import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Note } from './note.entity';

@Entity({ name: 'note_labels' })
export class NoteLabel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 32, default: '#94a3b8' })
  color!: string;

  @ManyToMany(() => Note, (note) => note.labels)
  notes!: Note[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
