import { Category } from '../../domain/category.entity';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CategoryMapper {
  static toDomain(row: CategoryRow): Category {
    return Category.reconstitute({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(category: Category): CategoryRow {
    const snapshot = category.toSnapshot();
    return {
      id: snapshot.id,
      name: snapshot.name,
      slug: snapshot.slug,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  }
}
