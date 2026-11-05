import { Category } from '../../domain/category.entity';
import { CategoryMapper } from './category.mapper';

describe('CategoryMapper', () => {
  it('round-trips through toPersistence -> toDomain', () => {
    const original = Category.create('T-Shirts', 't-shirts');
    const row = CategoryMapper.toPersistence(original);
    const rehydrated = CategoryMapper.toDomain(row);

    expect(rehydrated.id).toBe(original.id);
    expect(rehydrated.name).toBe(original.name);
    expect(rehydrated.slug).toBe(original.slug);
  });
});
