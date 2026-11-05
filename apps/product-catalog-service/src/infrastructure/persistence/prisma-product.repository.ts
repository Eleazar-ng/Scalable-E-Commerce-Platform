import { Injectable } from '@nestjs/common';
import {
  ConflictException,
  ExternalServiceException,
  isPrismaUniqueConstraintError,
} from '@ecommerce-platform/common';
import { Product } from '../../domain/product.aggregate';
import { ProductRepositoryPort } from '../../application/ports/product-repository.port';
import { PrismaService } from './prisma.service';
import { ProductMapper } from './product.mapper';

@Injectable()
export class PrismaProductRepository implements ProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(product: Product): Promise<void> {
    try {
      await this.prisma.product.create({ data: ProductMapper.toPersistence(product) });
    } catch (error) {
      throw this.wrapError('create', product.id, error);
    }
  }

  async update(product: Product): Promise<void> {
    const row = ProductMapper.toPersistence(product);
    try {
      await this.prisma.product.update({
        where: { id: row.id },
        data: {
          name: row.name,
          description: row.description,
          categoryId: row.categoryId,
          priceCents: row.priceCents,
          currency: row.currency,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      });
    } catch (error) {
      throw this.wrapError('update', product.id, error);
    }
  }

  async findById(productId: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({ where: { id: productId } });
    return row ? ProductMapper.toDomain(row) : null;
  }

  async findBySku(sku: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({ where: { sku } });
    return row ? ProductMapper.toDomain(row) : null;
  }

  async findByCategory(categoryId: string): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: { categoryId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    return rows.map(ProductMapper.toDomain);
  }

  private wrapError(
    operation: string,
    productId: string,
    error: unknown
  ): ConflictException | ExternalServiceException {
    if (isPrismaUniqueConstraintError(error)) {
      return new ConflictException('A product with this SKU already exists', { productId });
    }
    return new ExternalServiceException(`Product repository ${operation} failed`, {
      retryable: true,
      context: { operation, productId },
      cause: error,
    });
  }
}
