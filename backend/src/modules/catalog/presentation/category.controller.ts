import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from '../application/category.service';
import { CategoryDto } from '../application/dto/category.dto';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

function parseId(id: string): string {
  const normalized = id?.trim();
  if (!normalized) {
    throw new BadRequestException('id must be a non-empty string');
  }

  return normalized;
}

@Controller('catalog/categories')
@UseGuards(CatalogAuthorizationGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async list() {
    return this.categoryService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.categoryService.getById(parseId(id));
  }

  @Post()
  async create(@Body() body: unknown) {
    const dto = CategoryDto.validate(body);
    return this.categoryService.create({
      name: dto.name!,
      description: dto.description,
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const dto = CategoryDto.validateUpdate(body);
    return this.categoryService.update(parseId(id), {
      name: dto.name,
      description: dto.description,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.categoryService.remove(parseId(id));
  }
}