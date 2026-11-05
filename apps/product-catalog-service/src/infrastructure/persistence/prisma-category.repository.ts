import { Injectable } from '@nestjs/common';
import {
  ConflictException,
  ExternalServiceException,
  isPrismaUniqueConstraintError,
} from '@ecommerce-platform/common';
import { Category } from '../../domain/category.entity';
import { CategoryRepositoryPort } from '../../application/ports/category-repository.port';
import { PrismaService } from './prisma.service';
import { CategoryMapper } from './category.mapper';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(category: Category): Promise<void> {
    try {
      await this.prisma.category.create({ data: CategoryMapper.toPersistence(category) });
    } catch (error) {
      throw this.wrapError('create', category.id, error);
    }
  }

  async update(category: Category): Promise<void> {
    const row = CategoryMapper.toPersistence(category);
    try {
      await this.prisma.category.update({
        where: { id: row.id },
        data: { name: row.name, slug: row.slug, updatedAt: row.updatedAt },
      });
    } catch (error) {
      throw this.wrapError('update', category.id, error);
    }
  }

  async findById(categoryId: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id: categoryId } });
    return row ? CategoryMapper.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { slug } });
    return row ? CategoryMapper.toDomain(row) : null;
  }

  async findAll(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    return rows.map(CategoryMapper.toDomain);
  }

  private wrapError(
    operation: string,
    categoryId: string,
    error: unknown
  ): ConflictException | ExternalServiceException {
    if (isPrismaUniqueConstraintError(error)) {
      return new ConflictException('A category with this slug already exists', { categoryId });
    }
    return new ExternalServiceException(`Category repository ${operation} failed`, {
      retryable: true,
      context: { operation, categoryId },
      cause: error,
    });
  }
}
