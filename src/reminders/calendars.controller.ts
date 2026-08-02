import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CalendarsService } from './calendars.service';
import {
  CreateCalendarDto,
  CreateCalendarInviteDto,
  UpdateCalendarDto,
  UpdateCalendarMemberRoleDto,
} from './dto/calendar.dto';

@Controller('calendars')
@UseGuards(JwtAuthGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get()
  list(@Request() req) {
    return this.calendarsService.listCalendars(req.user.userId);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateCalendarDto) {
    return this.calendarsService.createCalendar(req.user.userId, dto);
  }

  @Get('invites/pending')
  listPending(@Request() req) {
    return this.calendarsService.listPendingInvitesForUser(req.user.userId);
  }

  @Post('invites/:token/accept')
  acceptInvite(@Request() req, @Param('token') token: string) {
    return this.calendarsService.acceptInvite(req.user.userId, token);
  }

  @Patch(':calendarId')
  update(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Body() dto: UpdateCalendarDto,
  ) {
    return this.calendarsService.updateCalendar(
      req.user.userId,
      calendarId,
      dto,
    );
  }

  @Delete(':calendarId')
  remove(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
  ) {
    return this.calendarsService.deleteCalendar(req.user.userId, calendarId);
  }

  @Get(':calendarId/members')
  listMembers(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
  ) {
    return this.calendarsService.listMembers(req.user.userId, calendarId);
  }

  @Patch(':calendarId/members/:userId')
  updateMemberRole(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateCalendarMemberRoleDto,
  ) {
    return this.calendarsService.updateMemberRole(
      req.user.userId,
      calendarId,
      userId,
      dto,
    );
  }

  @Delete(':calendarId/members/:userId')
  removeMember(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.calendarsService.removeMember(
      req.user.userId,
      calendarId,
      userId,
    );
  }

  @Post(':calendarId/invites')
  createInvite(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Body() dto: CreateCalendarInviteDto,
  ) {
    return this.calendarsService.createInvite(
      req.user.userId,
      calendarId,
      dto,
    );
  }

  @Get(':calendarId/invites')
  listInvites(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
  ) {
    return this.calendarsService.listInvites(req.user.userId, calendarId);
  }

  @Delete(':calendarId/invites/:inviteId')
  revokeInvite(
    @Request() req,
    @Param('calendarId', ParseUUIDPipe) calendarId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.calendarsService.revokeInvite(
      req.user.userId,
      calendarId,
      inviteId,
    );
  }
}
