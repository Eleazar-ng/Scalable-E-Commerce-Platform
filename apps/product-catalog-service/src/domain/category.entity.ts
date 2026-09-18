import { randomUUID } from 'crypto';
import { ValidationException } from '@ecommerce-platform/common';

export interface CategoryProps {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lightweight reference entity, not a full DDD aggregate - Category has no
 * real invariants beyond "has a name and a URL-safe slug" and doesn't
 * raise domain events. Product references it by categoryId.
 */
export class Category {
  private constructor(private props: CategoryProps) {}

  static create(name: string, slug: string): Category {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (trimmedName.length === 0) {
      throw new ValidationException('Category name cannot be empty');
    }
    if (!SLUG_PATTERN.test(trimmedSlug)) {
      throw new ValidationException('Category slug must be lowercase letters, numbers, and hyphens', {
        slug,
      });
    }

    const now = new Date();
    return new Category({
      id: randomUUID(),
      name: trimmedName,
      slug: trimmedSlug,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  rename(name: string, slug: string): void {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (trimmedName.length === 0) {
      throw new ValidationException('Category name cannot be empty');
    }
    if (!SLUG_PATTERN.test(trimmedSlug)) {
      throw new ValidationException('Category slug must be lowercase letters, numbers, and hyphens', {
        slug,
      });
    }

    this.props.name = trimmedName;
    this.props.slug = trimmedSlug;
    this.props.updatedAt = new Date();
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toSnapshot(): CategoryProps {
    return { ...this.props };
  }
}
