import { Product } from '../../domain/product.aggregate';
import { Sku } from '../../domain/value-objects/sku.vo';
import { Money } from '../../domain/value-objects/money.vo';
import { ProductStatus } from '../../../generated/prisma/enums';

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  priceCents: number;
  currency: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductMapper {
  static toDomain(row: ProductRow): Product {
    return Product.reconstitute({
      id: row.id,
      sku: Sku.create(row.sku),
      name: row.name,
      description: row.description,
      categoryId: row.categoryId,
      price: Money.create(row.priceCents, row.currency),
      status: row.status as 'ACTIVE' | 'DISCONTINUED',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(product: Product): ProductRow {
    const snapshot = product.toSnapshot();
    return {
      id: snapshot.id,
      sku: snapshot.sku.toString(),
      name: snapshot.name,
      description: snapshot.description,
      categoryId: snapshot.categoryId,
      priceCents: snapshot.price.toCents(),
      currency: snapshot.price.getCurrency(),
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  }
}
