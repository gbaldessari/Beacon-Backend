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
import {
  CreateHouseholdSpaceDto,
  CreateInviteDto,
  UpdateMemberRoleDto,
} from './dto/finance.dto';
import { SpacesService } from './spaces.service';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get('spaces')
  listSpaces(@Request() req) {
    return this.spacesService.listSpaces(req.user.userId);
  }

  @Post('spaces/household')
  createHousehold(@Request() req, @Body() dto: CreateHouseholdSpaceDto) {
    return this.spacesService.createHousehold(req.user.userId, dto);
  }

  @Get('spaces/:spaceId/members')
  listMembers(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
  ) {
    return this.spacesService.listMembers(req.user.userId, spaceId);
  }

  @Patch('spaces/:spaceId/members/:userId')
  updateMemberRole(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.spacesService.updateMemberRole(
      req.user.userId,
      spaceId,
      userId,
      dto,
    );
  }

  @Delete('spaces/:spaceId/members/:userId')
  removeMember(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.spacesService.removeMember(req.user.userId, spaceId, userId);
  }

  @Post('spaces/:spaceId/invites')
  createInvite(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.spacesService.createInvite(req.user.userId, spaceId, dto);
  }

  @Get('spaces/:spaceId/invites')
  listInvites(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
  ) {
    return this.spacesService.listInvites(req.user.userId, spaceId);
  }

  @Delete('spaces/:spaceId/invites/:inviteId')
  revokeInvite(
    @Request() req,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.spacesService.revokeInvite(
      req.user.userId,
      spaceId,
      inviteId,
    );
  }

  @Post('invites/:token/accept')
  acceptInvite(@Request() req, @Param('token') token: string) {
    return this.spacesService.acceptInvite(req.user.userId, token);
  }

  @Get('invites/pending')
  listPendingInvites(@Request() req) {
    return this.spacesService.listPendingInvitesForUser(req.user.userId);
  }
}
