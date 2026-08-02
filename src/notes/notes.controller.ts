import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import {
  CreateNoteDto,
  CreateNoteLabelDto,
  ListNotesQueryDto,
  UpdateNoteDto,
  UpdateNoteLabelDto,
} from './dto/note.dto';
import { NotesService } from './notes.service';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('labels')
  listLabels(@Request() req) {
    return this.notesService.listLabels(req.user.userId);
  }

  @Post('labels')
  createLabel(@Request() req, @Body() dto: CreateNoteLabelDto) {
    return this.notesService.createLabel(req.user.userId, dto);
  }

  @Patch('labels/:id')
  updateLabel(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteLabelDto,
  ) {
    return this.notesService.updateLabel(req.user.userId, id, dto);
  }

  @Delete('labels/:id')
  async deleteLabel(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.notesService.deleteLabel(req.user.userId, id);
    return { success: true };
  }

  @Get()
  list(@Request() req, @Query() query: ListNotesQueryDto) {
    return this.notesService.list(req.user.userId, query);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateNoteDto) {
    return this.notesService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.notesService.remove(req.user.userId, id);
    return { success: true };
  }
}
