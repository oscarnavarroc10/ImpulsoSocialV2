import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PublicCatalogService } from '../application/public-catalog.service';
import {
  PublicCatalogListResponseDto,
  PublicCatalogQueryDto,
  PublicCatalogServiceDto,
} from '../application/dto/public-catalog.dto';

function parsePublicId(id: string): string {
  const normalized = id?.trim();
  if (!normalized) {
    throw new BadRequestException('id must be a non-empty string');
  }

  return normalized;
}

@ApiTags('Public Catalog')
@Controller('v1/catalog/services')
export class PublicCatalogController {
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'List the public catalog of services for the configured tenant',
  })
  @ApiOkResponse({ type: PublicCatalogListResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or filter values',
  })
  async list(
    @Query() query: PublicCatalogQueryDto,
  ): Promise<PublicCatalogListResponseDto> {
    return this.publicCatalogService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one public service by its internal id',
  })
  @ApiOkResponse({ type: PublicCatalogServiceDto })
  @ApiBadRequestResponse({ description: 'Invalid service id' })
  @ApiNotFoundResponse({ description: 'Service not found or not visible' })
  async getById(@Param('id') id: string): Promise<PublicCatalogServiceDto> {
    return this.publicCatalogService.getById(parsePublicId(id));
  }
}
