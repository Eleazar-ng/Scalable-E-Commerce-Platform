import { Category } from '../../domain/category.entity';

export interface CategoryRepositoryPort {
  create(category: Category): Promise<void>;
  update(category: Category): Promise<void>;
  findById(categoryId: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
