import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Note } from './note.entity';

@Entity({ name: 'note_checklist_items' })
export class NoteChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  note_id!: string;

  @Column({ type: 'varchar', length: 500 })
  text!: string;

  @Column({ type: 'boolean', default: false })
  done!: boolean;

  @Column({ type: 'integer', default: 0 })
  position!: number;

  @ManyToOne(() => Note, (note) => note.checklist_items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'note_id' })
  note!: Note;
}
