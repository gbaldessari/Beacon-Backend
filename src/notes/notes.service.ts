import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CreateNoteDto,
  CreateNoteLabelDto,
  ListNotesQueryDto,
  UpdateNoteDto,
  UpdateNoteLabelDto,
} from './dto/note.dto';
import { NoteChecklistItem } from './entities/note-checklist-item.entity';
import { NoteLabel } from './entities/note-label.entity';
import { Note } from './entities/note.entity';

export type NoteLabelView = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type ChecklistItemView = {
  id: string;
  text: string;
  done: boolean;
  position: number;
};

export type NoteView = {
  id: string;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  isChecklist: boolean;
  position: number;
  checklistItems: ChecklistItemView[];
  labels: NoteLabelView[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly notesRepo: Repository<Note>,
    @InjectRepository(NoteChecklistItem)
    private readonly itemsRepo: Repository<NoteChecklistItem>,
    @InjectRepository(NoteLabel)
    private readonly labelsRepo: Repository<NoteLabel>,
  ) {}

  async list(userId: string, query: ListNotesQueryDto): Promise<NoteView[]> {
    const archived = query.archived === true;
    const qb = this.notesRepo
      .createQueryBuilder('note')
      .leftJoinAndSelect('note.checklist_items', 'items')
      .leftJoinAndSelect('note.labels', 'labels')
      .where('note.user_id = :userId', { userId })
      .andWhere('note.archived = :archived', { archived })
      .orderBy('note.pinned', 'DESC')
      .addOrderBy('note.position', 'ASC')
      .addOrderBy('note.updated_at', 'DESC');

    if (query.labelId) {
      qb.andWhere('labels.id = :labelId', { labelId: query.labelId });
    }

    if (query.q?.trim()) {
      const q = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(note.title) LIKE :q OR LOWER(note.body) LIKE :q)',
        { q },
      );
    }

    const notes = await qb.getMany();
    return notes.map((n) => this.toView(n));
  }

  async create(userId: string, dto: CreateNoteDto): Promise<NoteView> {
    const isChecklist = dto.isChecklist === true;
    const title = (dto.title ?? '').trim();
    const body = (dto.body ?? '').trim();
    const items = dto.checklistItems ?? [];

    if (!title && !body && !items.some((i) => i.text.trim())) {
      throw new BadRequestException('La nota no puede estar vacía.');
    }

    const maxPos = await this.notesRepo
      .createQueryBuilder('note')
      .select('MAX(note.position)', 'max')
      .where('note.user_id = :userId', { userId })
      .getRawOne<{ max: string | null }>();

    const note = this.notesRepo.create({
      user_id: userId,
      title,
      body: isChecklist ? '' : body,
      color: dto.color?.trim() || '#fff9c4',
      pinned: dto.pinned === true,
      archived: false,
      is_checklist: isChecklist,
      position: Number(maxPos?.max ?? 0) + 1,
      checklist_items: [],
      labels: [],
    });

    if (dto.labelIds?.length) {
      note.labels = await this.resolveLabels(userId, dto.labelIds);
    }

    const saved = await this.notesRepo.save(note);

    if (isChecklist && items.length) {
      saved.checklist_items = await this.replaceChecklist(saved.id, items);
    }

    return this.toView(await this.findOwnedOrFail(userId, saved.id));
  }

  async update(
    userId: string,
    noteId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteView> {
    const note = await this.findOwnedOrFail(userId, noteId);

    if (dto.title !== undefined) note.title = dto.title.trim();
    if (dto.body !== undefined) note.body = dto.body.trim();
    if (dto.color !== undefined) note.color = dto.color.trim() || note.color;
    if (dto.pinned !== undefined) note.pinned = dto.pinned;
    if (dto.archived !== undefined) note.archived = dto.archived;
    if (dto.position !== undefined) note.position = dto.position;
    if (dto.isChecklist !== undefined) note.is_checklist = dto.isChecklist;

    if (dto.labelIds !== undefined) {
      note.labels = await this.resolveLabels(userId, dto.labelIds);
    }

    await this.notesRepo.save(note);

    if (dto.checklistItems !== undefined) {
      if (!note.is_checklist) {
        note.is_checklist = true;
        await this.notesRepo.save(note);
      }
      await this.replaceChecklist(note.id, dto.checklistItems);
    }

    return this.toView(await this.findOwnedOrFail(userId, noteId));
  }

  async remove(userId: string, noteId: string): Promise<void> {
    const note = await this.findOwnedOrFail(userId, noteId);
    await this.notesRepo.remove(note);
  }

  async listLabels(userId: string): Promise<NoteLabelView[]> {
    const labels = await this.labelsRepo.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });
    return labels.map((l) => this.toLabelView(l));
  }

  async createLabel(
    userId: string,
    dto: CreateNoteLabelDto,
  ): Promise<NoteLabelView> {
    const name = dto.name.trim();
    const existing = await this.labelsRepo.findOne({
      where: { user_id: userId, name },
    });
    if (existing) {
      throw new ConflictException('Ya existe una etiqueta con ese nombre.');
    }

    const saved = await this.labelsRepo.save(
      this.labelsRepo.create({
        user_id: userId,
        name,
        color: dto.color?.trim() || '#94a3b8',
      }),
    );
    return this.toLabelView(saved);
  }

  async updateLabel(
    userId: string,
    labelId: string,
    dto: UpdateNoteLabelDto,
  ): Promise<NoteLabelView> {
    const label = await this.labelsRepo.findOne({
      where: { id: labelId, user_id: userId },
    });
    if (!label) {
      throw new NotFoundException('Etiqueta no encontrada.');
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.labelsRepo.findOne({
        where: { user_id: userId, name },
      });
      if (clash && clash.id !== labelId) {
        throw new ConflictException('Ya existe una etiqueta con ese nombre.');
      }
      label.name = name;
    }
    if (dto.color !== undefined) {
      label.color = dto.color.trim() || label.color;
    }
    return this.toLabelView(await this.labelsRepo.save(label));
  }

  async deleteLabel(userId: string, labelId: string): Promise<void> {
    const label = await this.labelsRepo.findOne({
      where: { id: labelId, user_id: userId },
    });
    if (!label) {
      throw new NotFoundException('Etiqueta no encontrada.');
    }
    await this.labelsRepo.remove(label);
  }

  private async replaceChecklist(
    noteId: string,
    items: Array<{ text: string; done?: boolean; position?: number }>,
  ): Promise<NoteChecklistItem[]> {
    await this.itemsRepo.delete({ note_id: noteId });
    const rows = items
      .map((item, index) => ({
        note_id: noteId,
        text: item.text.trim(),
        done: item.done === true,
        position: item.position ?? index,
      }))
      .filter((item) => item.text.length > 0);

    if (!rows.length) {
      return [];
    }

    return this.itemsRepo.save(rows.map((r) => this.itemsRepo.create(r)));
  }

  private async resolveLabels(
    userId: string,
    labelIds: string[],
  ): Promise<NoteLabel[]> {
    if (!labelIds.length) return [];
    const labels = await this.labelsRepo.find({
      where: { id: In(labelIds), user_id: userId },
    });
    if (labels.length !== labelIds.length) {
      throw new BadRequestException('Una o más etiquetas no existen.');
    }
    return labels;
  }

  private async findOwnedOrFail(userId: string, noteId: string): Promise<Note> {
    const note = await this.notesRepo.findOne({
      where: { id: noteId, user_id: userId },
      relations: ['checklist_items', 'labels'],
    });
    if (!note) {
      throw new NotFoundException('Nota no encontrada.');
    }
    return note;
  }

  private toView(note: Note): NoteView {
    const items = [...(note.checklist_items ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const labels = [...(note.labels ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return {
      id: note.id,
      title: note.title,
      body: note.body,
      color: note.color,
      pinned: note.pinned,
      archived: note.archived,
      isChecklist: note.is_checklist,
      position: note.position,
      checklistItems: items.map((item) => ({
        id: item.id,
        text: item.text,
        done: item.done,
        position: item.position,
      })),
      labels: labels.map((l) => this.toLabelView(l)),
      createdAt: note.created_at.toISOString(),
      updatedAt: note.updated_at.toISOString(),
    };
  }

  private toLabelView(label: NoteLabel): NoteLabelView {
    return {
      id: label.id,
      name: label.name,
      color: label.color,
      createdAt: label.created_at.toISOString(),
    };
  }
}
