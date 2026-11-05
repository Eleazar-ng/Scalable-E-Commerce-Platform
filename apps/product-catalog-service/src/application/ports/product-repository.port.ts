import { Product } from '../../domain/product.aggregate';

export interface ProductRepositoryPort {
  create(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
  findById(productId: string): Promise<Product | null>;
  findBySku(sku: string): Promise<Product | null>;
  findByCategory(categoryId: string): Promise<Product[]>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
