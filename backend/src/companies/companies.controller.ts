import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  /**
   * Every signed-in user needs their own company — the header names it, and the
   * folder pickers group by department. `companies.view_all` is the wrong gate
   * here: it means "see *every* company", which would 403 all ordinary users.
   * The service narrows the result to the caller's own company instead.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: any) {
    return this.companiesService.findAll(req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const seesAllCompanies =
      req.user?.permissions?.capabilities?.includes('companies.view_all');

    if (!seesAllCompanies && id !== req.user?.companyId) {
      throw new ForbiddenException('That company is not yours to view.');
    }

    return this.companiesService.findOne(id);
  }

  @Post()
  @RequireCapability('companies.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async create(@Body() createCompanyDto: CreateCompanyDto, @Request() req: any) {
    return this.companiesService.create(createCompanyDto, req.user);
  }

  @Put(':id')
  @RequireCapability('companies.manage')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto, @Request() req: any) {
    return this.companiesService.update(id, updateCompanyDto, req.user);
  }
}
