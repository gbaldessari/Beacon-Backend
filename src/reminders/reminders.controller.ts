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
  CreateReminderDto,
  SetReminderCompletionDto,
  UpdateReminderDto,
} from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

/**
 * API de recordatorios y tareas del usuario autenticado.
 */
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  async list(@Request() req, @Query('timezone') timezone?: string) {
    return this.remindersService.listForUser(req.user.userId, timezone);
  }

  @Get('upcoming')
  async upcoming(@Request() req, @Query('timezone') timezone?: string) {
    return this.remindersService.listUpcoming(req.user.userId, timezone);
  }

  @Get(':id/completions')
  async listCompletions(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remindersService.listCompletions(req.user.userId, id);
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateReminderDto) {
    return this.remindersService.create(req.user.userId, dto);
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(req.user.userId, id, dto);
  }

  @Patch(':id/completion')
  async setCompletion(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReminderCompletionDto,
    @Query('timezone') timezone?: string,
  ) {
    return this.remindersService.setCompletion(
      req.user.userId,
      id,
      dto,
      timezone,
    );
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.remindersService.remove(req.user.userId, id);
    return { success: true };
  }
}
