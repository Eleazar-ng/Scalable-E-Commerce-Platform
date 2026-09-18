import { randomUUID } from 'crypto';
import { Sku } from './value-objects/sku.vo';
import { Money } from './value-objects/money.vo';
import {
  InvalidProductNameException,
  ProductAlreadyActiveException,
  ProductAlreadyDiscontinuedException,
} from './product.errors';

export type ProductStatus = 'ACTIVE' | 'DISCONTINUED';

export interface ProductProps {
  id: string;
  sku: Sku;
  name: string;
  description: string;
  categoryId: string;
  price: Money;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Catalog-side product data (name, description, price, category, SKU).
 * Deliberately excludes stock - see Inventory, a separate aggregate, for
 * why (architecture decision: Stage 3.1 planning - catalog edits and
 * high-frequency stock reservations shouldn't contend for the same
 * aggregate).
 */
export class Product {
  private constructor(private props: ProductProps) {}

  static create(params: {
    sku: Sku;
    name: string;
    description: string;
    categoryId: string;
    price: Money;
  }): Product {
    const name = params.name.trim();
    if (name.length === 0) {
      throw new InvalidProductNameException();
    }

    const now = new Date();
    return new Product({
      id: randomUUID(),
      sku: params.sku,
      name,
      description: params.description.trim(),
      categoryId: params.categoryId,
      price: params.price,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  updateDetails(params: { name: string; description: string; price: Money }): void {
    const name = params.name.trim();
    if (name.length === 0) {
      throw new InvalidProductNameException();
    }

    this.props.name = name;
    this.props.description = params.description.trim();
    this.props.price = params.price;
    this.props.updatedAt = new Date();
  }

  changeCategory(categoryId: string): void {
    this.props.categoryId = categoryId;
    this.props.updatedAt = new Date();
  }

  discontinue(): void {
    if (this.props.status === 'DISCONTINUED') {
      throw new ProductAlreadyDiscontinuedException(this.props.id);
    }
    this.props.status = 'DISCONTINUED';
    this.props.updatedAt = new Date();
  }

  reactivate(): void {
    if (this.props.status === 'ACTIVE') {
      throw new ProductAlreadyActiveException(this.props.id);
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get sku(): Sku {
    return this.props.sku;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get price(): Money {
    return this.props.price;
  }

  get status(): ProductStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toSnapshot(): ProductProps {
    return { ...this.props };
  }
}
