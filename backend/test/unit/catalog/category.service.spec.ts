import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryService } from '../../../src/modules/catalog/application/category.service';

describe('CategoryService', () => {
  const categoryRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countMasterServicesUsingCategory: jest.fn(),
  };

  const service = new CategoryService(categoryRepository as any);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a category with normalized fields', async () => {
    categoryRepository.findAll.mockResolvedValue([]);
    categoryRepository.create.mockResolvedValue({
      id: 'cat-1',
      name: 'Growth',
      description: 'Instagram growth services',
    });

    const result = await service.create({
      name: '  Growth  ',
      description: '  Instagram growth services  ',
    });

    expect(categoryRepository.create).toHaveBeenCalledWith({
      name: 'Growth',
      description: 'Instagram growth services',
    });
    expect(result).toEqual({
      id: 'cat-1',
      name: 'Growth',
      description: 'Instagram growth services',
    });
  });

  it('rejects duplicate category names ignoring case', async () => {
    categoryRepository.findAll.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Growth',
        description: null,
      },
    ]);

    await expect(
      service.create({
        name: 'growth',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a category and keeps uniqueness checks', async () => {
    categoryRepository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Growth',
      description: null,
    });
    categoryRepository.findAll.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Growth',
        description: null,
      },
      {
        id: 'cat-2',
        name: 'Engagement',
        description: null,
      },
    ]);
    categoryRepository.update.mockResolvedValue({
      id: 'cat-1',
      name: 'Growth and Reach',
      description: 'Updated',
    });

    const result = await service.update('cat-1', {
      name: '  Growth and Reach ',
      description: ' Updated ',
    });

    expect(categoryRepository.update).toHaveBeenCalledWith('cat-1', {
      name: 'Growth and Reach',
      description: 'Updated',
    });
    expect(result).toEqual({
      id: 'cat-1',
      name: 'Growth and Reach',
      description: 'Updated',
    });
  });

  it('fails when updating a missing category', async () => {
    categoryRepository.findById.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes a category when no active or draft services reference it', async () => {
    categoryRepository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Growth',
      description: null,
    });
    categoryRepository.countMasterServicesUsingCategory.mockResolvedValue(0);

    const result = await service.remove('cat-1');

    expect(categoryRepository.delete).toHaveBeenCalledWith('cat-1');
    expect(result).toEqual({
      categoryId: 'cat-1',
      action: 'deleted',
    });
  });

  it('blocks deletion when category is assigned to active catalog services', async () => {
    categoryRepository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Growth',
      description: null,
    });
    categoryRepository.countMasterServicesUsingCategory.mockResolvedValue(2);

    await expect(service.remove('cat-1')).rejects.toThrow(BadRequestException);
    expect(categoryRepository.delete).not.toHaveBeenCalled();
  });
});