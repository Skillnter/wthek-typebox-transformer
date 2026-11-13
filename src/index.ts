import { TypeBoxError } from "@sinclair/typebox";
import type { ValueError } from "@sinclair/typebox/errors";
import { KitHttpError } from "http-error-kit";
import { BAD_REQUEST } from "http-response-status-code";

/**
 * Configuration options for KitTypeBoxTransformer and fromTypeBoxError.
 *
 * @interface IKitTypeBoxTransformerOptions
 */
export interface IKitTypeBoxTransformerOptions {
  /**
   * Custom error message for the transformed KitHttpError.
   *
   * @type {string}
   * @default "TypeBox Validation Failed"
   */
  message?: string;

  /**
   * Custom HTTP status code to assign to the validation error.
   *
   * @type {number}
   * @default 400 (BAD_REQUEST)
   */
  statusCode?: number;
}

/**
 * Type guard to verify whether a candidate value conforms to the TypeBox ValueError shape.
 *
 * @param {unknown} value - The candidate value to evaluate.
 * @returns {boolean} True if the value has path, message, and type properties.
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
 * Extracts validation issues from an instance of TypeBoxError.
 * Inspects both .errors and .error properties for detailed ValueError records,
 * falling back to a message object if neither is available.
 *
 * @param {TypeBoxError} error - The TypeBoxError instance.
 * @returns {unknown[]} An array of validation issues.
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
 * Validates whether an array contains TypeBox ValueError items and returns it.
 *
 * @param {unknown[]} items - Candidate array of items.
 * @returns {unknown[] | null} The array if the first item is a ValueError, otherwise null.
 */
const extractFromErrorsArray = (items: unknown[]): unknown[] | null => {
  const [firstItem] = items;
  if (firstItem !== undefined && isValueError(firstItem)) {
    return items;
  }
  return null;
};

/**
 * Inspects an iterable (such as a ValueErrorIterator returned by Value.Errors)
 * and extracts its issues.
 *
 * @param {object} error - The iterable object to extract from.
 * @returns {unknown[] | null} Array of issues, or null if empty or non-matching.
 */
const extractFromIterable = (error: object): unknown[] | null => {
  if (
    Symbol.iterator in error &&
    typeof (error as Iterable<unknown>)[Symbol.iterator] === "function"
  ) {
    return extractFromErrorsArray(Array.from(error as Iterable<unknown>));
  }
  return null;
};

/**
 * Inspects an object error for either an .errors array or iterator capabilities.
 *
 * @param {object} error - The object error to inspect.
 * @returns {unknown[] | null} Array of issues, or null if not a matching shape.
 */
const extractFromObject = (error: object): unknown[] | null => {
  const errorObj = error as { errors?: unknown[] };
  if (Array.isArray(errorObj.errors)) {
    return extractFromErrorsArray(errorObj.errors);
  }
  return extractFromIterable(error);
};

/**
 * Extracts validation issues from various TypeBox error representations:
 * - TypeBoxError instance (such as AssertError from Value.Assert)
 * - Array of ValueError objects (ValueError[])
 * - Single ValueError object
 * - Object containing an errors array ({ errors: ValueError[] })
 * - IterableIterator of ValueError objects (e.g. Value.Errors())
 *
 * @param {unknown} error - The error to inspect.
 * @returns {unknown[] | null} An array of validation issues, or null if not a TypeBox error.
 */
const extractIssues = (error: unknown): unknown[] | null => {
  if (error instanceof TypeBoxError) {
    return extractIssuesFromTypeBoxError(error);
  }

  if (Array.isArray(error)) {
    return extractFromErrorsArray(error);
  }

  if (isValueError(error)) {
    return [error];
  }

  if (typeof error === "object" && error !== null) {
    return extractFromObject(error);
  }

  return null;
};

/**
 * Converts TypeBox validation errors into a KitHttpError instance without throwing.
 * Returns null if the provided error is not a recognised TypeBox validation error.
 *
 * Accepts all standard TypeBox validation formats:
 * - Instances of `TypeBoxError` (such as `AssertError` from `Value.Assert`)
 * - Arrays of `ValueError` (e.g. `[...Value.Errors(schema, data)]`)
 * - Direct iterators from `Value.Errors(schema, data)`
 * - Single `ValueError` objects
 * - Object wrappers containing `{ errors: ValueError[] }`
 *
 * @param {unknown} error The error to check and transform.
 * @param {IKitTypeBoxTransformerOptions} [options] Optional configuration for the transformed error.
 * @returns {KitHttpError | null} The transformed KitHttpError, or null if not a TypeBox error.
 *
 * @example
 * ```typescript
 * import { fromTypeBoxError } from "@wthek/typebox-transformer";
 * import { Value } from "@sinclair/typebox/value";
 * import { Type } from "@sinclair/typebox";
 *
 * const UserSchema = Type.Object({ name: Type.String() });
 * const errors = [...Value.Errors(UserSchema, data)];
 * const kitError = fromTypeBoxError(errors, { message: "Invalid Input" });
 * if (kitError) {
 *   // Send formatted JSON error response
 *   return res.status(kitError.statusCode).json(kitError.toJSON());
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
 * it is re-thrown unchanged.
 *
 * @param {unknown} error The error to check and transform.
 * @param {IKitTypeBoxTransformerOptions} [options] Optional configuration for the transformed error.
 * @throws {KitHttpError} If the error is a recognized TypeBox validation error.
 * @throws {unknown} If the error is not a TypeBox error, it is re-thrown as-is.
 *
 * @example
 * ```typescript
 * import { KitTypeBoxTransformer } from "@wthek/typebox-transformer";
 * import { Value } from "@sinclair/typebox/value";
 * import { Type } from "@sinclair/typebox";
 *
 * const UserSchema = Type.Object({ age: Type.Number({ minimum: 18 }) });
 *
 * try {
 *   Value.Assert(UserSchema, data);
 * } catch (err) {
 *   KitTypeBoxTransformer(err, {
 *     message: "Age requirement not met",
 *     statusCode: 422,
 *   });
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
