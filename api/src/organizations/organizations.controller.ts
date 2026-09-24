import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthedUser } from '../auth/auth.service';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('me')
  async getOwn(@CurrentUser() user: AuthedUser) {
    const org = await this.organizations.getOwn(user.organizationId);
    return { ...org, email: user.email };
  }

  @Patch('me')
  updateOwn(@CurrentUser() user: AuthedUser, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.updateOwn(user.organizationId, dto);
  }

  // Listado de todas las personas de la cuenta, de todos los equipos a la
  // vez — nombre, equipo y canal por el que reciben el feedback. Pedido
  // explícito: antes solo se podía ver equipo por equipo.
  @Get('members')
  listMembers(@CurrentUser() user: AuthedUser) {
    return this.organizations.listMembers(user.organizationId);
  }
}
