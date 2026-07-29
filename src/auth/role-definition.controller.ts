import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  CreateRoleDefinitionDto,
  RoleDefinitionDto,
} from './dto/role-definition.dto';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { Roles } from './guard/roles.decorator';
import { RolesGuard } from './guard/roles.guard';
import { RoleDefinitionService } from './role-definition.service';
import { Role } from './roles/role.enum';

@Controller('auth/roles')
export class RoleDefinitionController {
  constructor(private readonly roleDefinitionService: RoleDefinitionService) {}

  @Get('public-registration')
  async listPublicRegistrationRoles(): Promise<RoleDefinitionDto[]> {
    return this.roleDefinitionService.listPublicRegistrationRoles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async listRoles(): Promise<RoleDefinitionDto[]> {
    return this.roleDefinitionService.listRoles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async createRole(
    @Request() req,
    @Body() payload: CreateRoleDefinitionDto,
  ): Promise<RoleDefinitionDto> {
    return this.roleDefinitionService.createRole(req.user.userId, payload);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteRole(@Request() req, @Param('id') roleId: string): Promise<void> {
    return this.roleDefinitionService.deleteRole(req.user.userId, roleId);
  }
}
