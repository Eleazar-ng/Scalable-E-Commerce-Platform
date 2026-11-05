import { Category } from '../../domain/category.entity';
import { PrismaCategoryRepository } from './prisma-category.repository';
import { CategoryMapper } from './category.mapper';

function buildPrismaMock() {
  return {
    category: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

function buildCategory(): Category {
  return Category.create('T-Shirts', 't-shirts');
}

describe('PrismaCategoryRepository', () => {
  it('create() persists the mapped row', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaCategoryRepository(prisma as any);
    const category = buildCategory();

    await repo.create(category);

    expect(prisma.category.create).toHaveBeenCalledWith({ data: CategoryMapper.toPersistence(category) });
  });

  it('create() translates a P2002 error into ConflictException', async () => {
    const prisma = buildPrismaMock();
    prisma.category.create.mockRejectedValue({ code: 'P2002' });
    const repo = new PrismaCategoryRepository(prisma as any);

    await expect(repo.create(buildCategory())).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('update() sends the renamed fields', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaCategoryRepository(prisma as any);
    const category = buildCategory();
    category.rename('Shirts', 'shirts');

    await repo.update(category);

    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: category.id },
      data: expect.objectContaining({ name: 'Shirts', slug: 'shirts' }),
    });
  });

  it('findById() returns null when not found', async () => {
    const prisma = buildPrismaMock();
    prisma.category.findUnique.mockResolvedValue(null);
    const repo = new PrismaCategoryRepository(prisma as any);

    expect(await repo.findById('missing')).toBeNull();
  });

  it('findBySlug() maps a found row', async () => {
    const prisma = buildPrismaMock();
    const category = buildCategory();
    prisma.category.findUnique.mockResolvedValue(CategoryMapper.toPersistence(category));
    const repo = new PrismaCategoryRepository(prisma as any);

    const result = await repo.findBySlug('t-shirts');
    expect(result?.name).toBe('T-Shirts');
  });

  it('findAll() maps every row, ordered by name', async () => {
    const prisma = buildPrismaMock();
    prisma.category.findMany.mockResolvedValue([CategoryMapper.toPersistence(buildCategory())]);
    const repo = new PrismaCategoryRepository(prisma as any);

    const result = await repo.findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(result).toHaveLength(1);
  });
});
