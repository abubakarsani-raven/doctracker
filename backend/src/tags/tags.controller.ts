import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard, RequireCapability } from '../permissions/require-capability.decorator';
import { CreateTagDto, SetDocumentTagsDto } from './dto/tag.dto';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTags(
    @Request() req: any,
    @Query('companyId') companyId?: string,
  ) {
    // Use the user's companyId if none specified (for security)
    const targetCompanyId = companyId || req.user.companyId;
    
    // Only allow access to own company's tags unless user has cross-company access
    if (targetCompanyId !== req.user.companyId && req.user.permissions?.dataScope !== 'all') {
      throw new Error('Access denied');
    }

    return this.tagsService.getTags(targetCompanyId);
  }

  @Post()
  @RequireCapability('documents.edit')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  async createTag(
    @Request() req: any,
    @Body() body: CreateTagDto,
  ) {
    return this.tagsService.createTag(req.user.companyId, body.name, req.user.id);
  }

  @Get('files/:fileId')
  @UseGuards(JwtAuthGuard)
  async getFileTags(
    @Param('fileId') fileId: string,
    @Request() req: any,
  ) {
    return this.tagsService.getFileTags(fileId, req.user.id);
  }

  @Post('files/:fileId')
  @UseGuards(JwtAuthGuard)
  async updateFileTags(
    @Param('fileId') fileId: string,
    @Body() body: SetDocumentTagsDto,
    @Request() req: any,
  ) {
    return this.tagsService.updateFileTags(fileId, body.tagIds, req.user.id);
  }
}