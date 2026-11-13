import { TypeBoxError } from "@sinclair/typebox";
import type { ValueError } from "@sinclair/typebox/errors";
import { KitHttpError } from "http-error-kit";
import { BAD_REQUEST } from "http-response-status-code";

/**
 * Configuration options for KitTypeBoxTransformer and fromTypeBoxError.
 */
export interface IKitTypeBoxTransformerOptions {
  /**
   * Custom message for the transformed error.
   *
   * @default "TypeBox Validation Failed"
   */
  message?: string;

  /**
   * Custom HTTP status code for the validation error.
   *
   * @default 400 (BAD_REQUEST)
   */
  statusCode?: number;
}

/**
 * Type guard to check if a value matches the ValueError shape.
 */
const isValueError = (value: unknown): value is ValueError => {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    "message" in value &&
    "type" in value
  );
};

/**
 * Extracts issues from an instance of TypeBoxError.
 */
const extractIssuesFromTypeBoxError = (error: TypeBoxError): unknown[] => {
  const customError = error as { error?: unknown; errors?: unknown[] };
  if (Array.isArray(customError.errors)) {
    return customError.errors;
  }
  if (isValueError(customError.error)) {
    return [customError.error];
  }
  return [{ message: error.message }];
};

/**
 * Extracts validation issues from various TypeBox error representations:
 * - TypeBoxError instance (such as AssertError)
 * - Array of ValueError objects (ValueError[])
 * - Single ValueError object
 * - Object containing an errors array ({ errors: ValueError[] })
 * - IterableIterator of ValueError objects (e.g. Value.Errors())
 */
const extractIssues = (error: unknown): unknown[] | null => {
  if (error instanceof TypeBoxError) {
    return extractIssuesFromTypeBoxError(error);
  }

  if (Array.isArray(error)) {
    if (error.length > 0 && isValueError(error[0])) {
      return error;
    }
    return null;
  }

  if (isValueError(error)) {
    return [error];
  }

  if (typeof error === "object" && error !== null) {
    const errorObj = error as { errors?: unknown[] };
    if (
      Array.isArray(errorObj.errors) &&
      errorObj.errors.length > 0 &&
      isValueError(errorObj.errors[0])
    ) {
      return errorObj.errors;
    }

    if (
      Symbol.iterator in error &&
      typeof (error as Iterable<unknown>)[Symbol.iterator] === "function"
    ) {
      const items = Array.from(error as Iterable<unknown>);
      if (items.length > 0 && isValueError(items[0])) {
        return items;
      }
    }
  }

  return null;
};

/**
 * Converts TypeBox validation errors into a KitHttpError instance without throwing.
 * Returns null if the provided error is not a recognised TypeBox validation error.
 *
 * @param {unknown} error The error to check and transform.
 * @param {IKitTypeBoxTransformerOptions} [options] Optional configuration for the transformed error.
 * @returns {KitHttpError | null} The transformed KitHttpError, or null if not a TypeBox error.
 *
 * @example
 * ```typescript
 * import { fromTypeBoxError } from "@wthek/typebox-transformer";
 * import { Value } from "@sinclair/typebox/value";
 *
 * const errors = [...Value.Errors(schema, data)];
 * const kitError = fromTypeBoxError(errors, { message: "Invalid Input" });
 * if (kitError) {
 *   // handle kitError
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export const fromTypeBoxError = (
  error: unknown,
  options?: IKitTypeBoxTransformerOptions,
): KitHttpError | null => {
  const issues = extractIssues(error);
  if (!issues) {
    return null;
  }

  const {
    message = "TypeBox Validation Failed",
    statusCode = BAD_REQUEST,
  } = options ?? {};

  return new KitHttpError(statusCode, message, {
    issues,
  });
};

/**
 * Transforms a TypeBox validation error into a structured KitHttpError with a
 * BadRequest status and throws it. If the error is not a TypeBox validation error,
 * it is thrown unchanged.
 *
 * @param {unknown} error The error to check and transform.
 * @param {IKitTypeBoxTransformerOptions} [options] Optional configuration for the transformed error.
 * @throws {KitHttpError} If the error is a TypeBox validation error.
 * @throws {unknown} If the error is not a TypeBox error, it is thrown as-is.
 *
 * @example
 * ```typescript
 * import { KitTypeBoxTransformer } from "@wthek/typebox-transformer";
 * import { Value } from "@sinclair/typebox/value";
 *
 * try {
 *   Value.Assert(schema, data);
 * } catch (err) {
 *   KitTypeBoxTransformer(err); // Throws KitHttpError or rethrows err
 * }
 * ```
 */
export const KitTypeBoxTransformer = (
  error: unknown,
  options?: IKitTypeBoxTransformerOptions,
): never => {
  const kitError = fromTypeBoxError(error, options);
  if (kitError) {
    throw kitError;
  }
  throw error;
};
