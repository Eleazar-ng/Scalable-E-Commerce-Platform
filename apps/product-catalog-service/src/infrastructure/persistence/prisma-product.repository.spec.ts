import { Product } from '../../domain/product.aggregate';
import { Sku } from '../../domain/value-objects/sku.vo';
import { Money } from '../../domain/value-objects/money.vo';
import { PrismaProductRepository } from './prisma-product.repository';
import { ProductMapper } from './product.mapper';

function buildPrismaMock() {
  return {
    product: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
}

function buildProduct(): Product {
  return Product.create({
    sku: Sku.create('TSHIRT-BLU-M'),
    name: 'Blue T-Shirt',
    description: 'A shirt',
    categoryId: 'cat-1',
    price: Money.create(1999, 'USD'),
  });
}

describe('PrismaProductRepository', () => {
  it('create() persists the mapped row', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaProductRepository(prisma as any);
    const product = buildProduct();

    await repo.create(product);

    expect(prisma.product.create).toHaveBeenCalledWith({ data: ProductMapper.toPersistence(product) });
  });

  it('create() translates a P2002 error into ConflictException', async () => {
    const prisma = buildPrismaMock();
    prisma.product.create.mockRejectedValue({ code: 'P2002' });
    const repo = new PrismaProductRepository(prisma as any);

    await expect(repo.create(buildProduct())).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('update() sends the updated catalog fields', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaProductRepository(prisma as any);
    const product = buildProduct();
    product.discontinue();

    await repo.update(product);

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: product.id },
      data: expect.objectContaining({ status: 'DISCONTINUED' }),
    });
  });

  it('findById() returns null when not found', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findUnique.mockResolvedValue(null);
    const repo = new PrismaProductRepository(prisma as any);

    expect(await repo.findById('missing')).toBeNull();
  });

  it('findBySku() maps a found row', async () => {
    const prisma = buildPrismaMock();
    const product = buildProduct();
    prisma.product.findUnique.mockResolvedValue(ProductMapper.toPersistence(product));
    const repo = new PrismaProductRepository(prisma as any);

    const result = await repo.findBySku('TSHIRT-BLU-M');
    expect(result?.name).toBe('Blue T-Shirt');
  });

  it('findByCategory() queries only ACTIVE products in that category, ordered by name', async () => {
    const prisma = buildPrismaMock();
    prisma.product.findMany.mockResolvedValue([ProductMapper.toPersistence(buildProduct())]);
    const repo = new PrismaProductRepository(prisma as any);

    const result = await repo.findByCategory('cat-1');

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { categoryId: 'cat-1', status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    expect(result).toHaveLength(1);
  });
});
