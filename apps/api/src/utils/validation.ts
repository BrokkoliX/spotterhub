import { GraphQLError } from 'graphql';

/**
 * Validates a string field's length and throws a BAD_USER_INPUT error if invalid.
 */
export function validateStringLength(
  value: string | null | undefined,
  fieldName: string,
  minLength: number,
  maxLength: number,
): void {
  if (value == null) return;
  if (value.length < minLength || value.length > maxLength) {
    throw new GraphQLError(
      `${fieldName} must be between ${minLength} and ${maxLength} characters`,
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
}

/**
 * Validates a slug format: lowercase alphanumeric + hyphens, 3-50 chars.
 */
export function validateSlug(value: string, fieldName: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new GraphQLError(
      `${fieldName} must contain only lowercase letters, numbers, and hyphens`,
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
  validateStringLength(value, fieldName, 3, 50);
}

/**
 * Validates an array doesn't exceed a maximum size.
 */
export function validateArrayLength(
  arr: unknown[] | null | undefined,
  fieldName: string,
  maxLength: number,
): void {
  if (arr && arr.length > maxLength) {
    throw new GraphQLError(`${fieldName} cannot have more than ${maxLength} items`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
}
