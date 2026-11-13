import { Type, TypeBoxError } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { KitHttpError } from "http-error-kit";
import { BAD_REQUEST, UNPROCESSABLE_ENTITY } from "http-response-status-code";
import {
  fromTypeBoxError,
  KitTypeBoxTransformer,
} from "../src/index";

describe("TypeBox Transformer", () => {
  const UserSchema = Type.Object({
    age: Type.Number(),
    name: Type.String(),
  });

  describe("fromTypeBoxError", () => {
    it("should transform AssertError from Value.Assert into KitHttpError", () => {
      try {
        Value.Assert(UserSchema, { age: "not-a-number", name: 123 });
        fail("Should have thrown AssertError");
      } catch (err: unknown) {
        const kitError = fromTypeBoxError(err);
        expect(kitError).toBeInstanceOf(KitHttpError);
        expect(kitError?.statusCode).toBe(BAD_REQUEST);
        expect(kitError?.message).toBe("TypeBox Validation Failed");
        expect(kitError?.getInputs()?.statusCode).toBe(BAD_REQUEST);
      }
    });

    it("should transform an array of ValueError items into KitHttpError", () => {
      const errors = [...Value.Errors(UserSchema, { age: "wrong", name: 123 })];
      const kitError = fromTypeBoxError(errors);

      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(BAD_REQUEST);
      expect(((kitError?.details as any)?.issues as unknown[]).length).toBeGreaterThan(0);
    });

    it("should transform an IterableIterator of ValueError items directly", () => {
      const iterator = Value.Errors(UserSchema, { age: "wrong", name: 123 });
      const kitError = fromTypeBoxError(iterator);

      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(BAD_REQUEST);
    });

    it("should transform a single ValueError item into KitHttpError", () => {
      const [singleError] = [...Value.Errors(UserSchema, { age: "wrong", name: "Alice" })];
      const kitError = fromTypeBoxError(singleError);

      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(BAD_REQUEST);
      expect(((kitError?.details as any)?.issues as unknown[])).toHaveLength(1);
    });

    it("should transform an object containing errors array", () => {
      const errors = [...Value.Errors(UserSchema, { age: "wrong", name: "Alice" })];
      const kitError = fromTypeBoxError({ errors });

      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(BAD_REQUEST);
    });

    it("should transform TypeBoxError having an errors array", () => {
      const errorWithErrors = new TypeBoxError("Custom TypeBox error");
      const [issue] = [...Value.Errors(UserSchema, { age: "wrong", name: "Alice" })];
      (errorWithErrors as any).errors = [issue];

      const kitError = fromTypeBoxError(errorWithErrors);
      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(BAD_REQUEST);
    });

    it("should transform base TypeBoxError without specific ValueError details", () => {
      const baseError = new TypeBoxError("Base TypeBox decode error");
      const kitError = fromTypeBoxError(baseError);

      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(BAD_REQUEST);
      expect((kitError?.details as any)?.issues).toEqual([
        { message: "Base TypeBox decode error" },
      ]);
    });

    it("should apply custom message and statusCode options", () => {
      const errors = [...Value.Errors(UserSchema, { age: "wrong", name: 123 })];
      const kitError = fromTypeBoxError(errors, {
        message: "Invalid User Profile",
        statusCode: UNPROCESSABLE_ENTITY,
      });

      expect(kitError).toBeInstanceOf(KitHttpError);
      expect(kitError?.statusCode).toBe(UNPROCESSABLE_ENTITY);
      expect(kitError?.message).toBe("Invalid User Profile");
    });

    it("should return null for empty array", () => {
      expect(fromTypeBoxError([])).toBeNull();
    });

    it("should return null for array of non-ValueError items", () => {
      expect(fromTypeBoxError(["error1", "error2"])).toBeNull();
    });

    it("should return null for standard Error instances", () => {
      expect(fromTypeBoxError(new Error("Standard system error"))).toBeNull();
    });

    it("should return null for primitives and null/undefined", () => {
      expect(fromTypeBoxError(null)).toBeNull();
      expect(fromTypeBoxError(undefined)).toBeNull();
      expect(fromTypeBoxError("validation error string")).toBeNull();
      expect(fromTypeBoxError(12345)).toBeNull();
    });

    it("should return null for objects without valid ValueError shape", () => {
      expect(fromTypeBoxError({ foo: "bar" })).toBeNull();
      expect(fromTypeBoxError({ errors: [] })).toBeNull();
      expect(fromTypeBoxError({ errors: ["not-a-value-error"] })).toBeNull();
    });

    it("should return null for iterables yielding non-ValueError items", () => {
      const set = new Set(["foo", "bar"]);
      expect(fromTypeBoxError(set)).toBeNull();
    });
  });

  describe("KitTypeBoxTransformer", () => {
    it("should throw KitHttpError when given a TypeBox validation error", () => {
      const errors = [...Value.Errors(UserSchema, { age: "wrong", name: 123 })];

      expect(() => {
        KitTypeBoxTransformer(errors);
      }).toThrow(KitHttpError);
    });

    it("should re-throw the original error when not a TypeBox error", () => {
      const genericError = new Error("Generic failure");

      expect(() => {
        KitTypeBoxTransformer(genericError);
      }).toThrow(genericError);
    });
  });
});
