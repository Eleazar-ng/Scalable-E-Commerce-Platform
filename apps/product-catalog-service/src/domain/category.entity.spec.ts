import { Category } from './category.entity';

describe('Category.create', () => {
  it('creates a category with a valid name and slug', () => {
    const category = Category.create('T-Shirts', 't-shirts');
    expect(category.name).toBe('T-Shirts');
    expect(category.slug).toBe('t-shirts');
  });

  it('trims and lowercases the slug', () => {
    const category = Category.create('T-Shirts', '  T-SHIRTS  ');
    expect(category.slug).toBe('t-shirts');
  });

  it('rejects an empty name', () => {
    expect(() => Category.create('', 't-shirts')).toThrow();
  });

  it.each(['T Shirts', 'shirts_blue', 'shirts--', '-shirts', ''])(
    'rejects an invalid slug: %s',
    (slug) => {
      expect(() => Category.create('Name', slug)).toThrow();
    }
  );
});

describe('Category.rename', () => {
  it('updates name and slug', () => {
    const category = Category.create('T-Shirts', 't-shirts');
    category.rename('Shirts', 'shirts');
    expect(category.name).toBe('Shirts');
    expect(category.slug).toBe('shirts');
  });

  it('rejects an invalid slug on rename', () => {
    const category = Category.create('T-Shirts', 't-shirts');
    expect(() => category.rename('Shirts', 'Invalid Slug')).toThrow();
  });
});

describe('Category.reconstitute', () => {
  it('rehydrates from persisted props', () => {
    const now = new Date();
    const category = Category.reconstitute({
      id: 'cat-1',
      name: 'Shoes',
      slug: 'shoes',
      createdAt: now,
      updatedAt: now,
    });
    expect(category.id).toBe('cat-1');
    expect(category.name).toBe('Shoes');
  });
});
