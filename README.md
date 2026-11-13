# Official @wthek Extension – TypeBox Transformer for `http-error-kit`

**Convert TypeBox validation errors into structured `http-error-kit` errors — framework-free**

_Built for projects using [`http-error-kit`][http-error-kit], this utility transforms native TypeBox validation errors into rich, consistent `BadRequestError` responses._

> 💡 What the HEK?! Tired of parsing raw TypeBox errors? Let `@wthek/typebox-transformer` convert them into usable, standardized errors — no framework needed.

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/skillnter/wthek-typebox-transformer/main.yml)
[![npm version](https://img.shields.io/npm/v/%40wthek%2Ftypebox-transformer?color=brightgreen)](https://www.npmjs.com/package/@wthek/typebox-transformer)
[![GitHub license](https://img.shields.io/github/license/skillnter/wthek-typebox-transformer?color=brightgreen)](LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/Skillnter/wthek-typebox-transformer)](https://github.com/Skillnter/wthek-typebox-transformer/issues)
![npm](https://img.shields.io/npm/dy/%40wthek%2Ftypebox-transformer)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/%40wthek%2Ftypebox-transformer)](https://bundlephobia.com/package/%40wthek%2Ftypebox-transformer)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/256715e97d954a5cb5afd9cca3039419)](https://app.codacy.com/gh/Skillnter/wthek-typebox-transformer/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/256715e97d954a5cb5afd9cca3039419)](https://app.codacy.com/gh/Skillnter/wthek-typebox-transformer/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_coverage)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@wthek/typebox-transformer/1.0.0)](https://socket.dev/npm/package/@wthek/typebox-transformer/overview/1.0.0)
[![Github Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-30363D?&logo=GitHub-Sponsors&logoColor=EA4AAA)](https://github.com/sponsors/Skillnter)
[![Open Collective](https://img.shields.io/badge/Open%20Collective-3385FF?logo=open-collective&logoColor=white)](https://opencollective.com/skillnter)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/skillnter)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?logo=patreon&logoColor=white)](https://www.patreon.com/skillnter)
[![PayPal](https://img.shields.io/badge/PayPal-003087?logo=paypal&logoColor=fff)](https://www.paypal.me/skillnte)

## Features

- **Framework-Agnostic** – Works with any HTTP server: Express, Fastify, Hono, Koa, NestJS, Restify, etc.
- **Dual Conversion APIs** – Use `KitTypeBoxTransformer` (throwing) or `fromTypeBoxError` (non-throwing).
- **Supports All TypeBox Error Formats** – Accepts `TypeBoxError` instances (like `AssertError`), `ValueError[]` arrays, single `ValueError`, or `Value.Errors()` iterators.
- **Preserves Issue Details** – Keeps raw TypeBox error details attached to `error.details.issues`.
- **Configurable Options** – Customize the error message and HTTP status code (e.g. 422 Unprocessable Entity).
- **Formatter-Friendly** – Customize output using `KitHttpErrorConfig.configureFormatter`.
- **Composable** – Pairs seamlessly with `@wthek/*-middleware` extensions.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [Explore More WTHek Extensions](#explore-more-wthek-extensions)
- [People](#people)
- [Donations](#donations)
- [License](#license)

## Installation

```console
npm install @wthek/typebox-transformer
```

## Usage

### 1. `KitTypeBoxTransformer` (Throws)

Transforms any TypeBox validation error into a `KitHttpError` and throws it. If the error is not a TypeBox error, it is thrown unchanged.

```typescript
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { KitTypeBoxTransformer } from "@wthek/typebox-transformer";

const UserSchema = Type.Object({
  name: Type.String(),
  age: Type.Number({ minimum: 18 }),
});

try {
  Value.Assert(UserSchema, { name: "Hek", age: 14 }); // Fails validation
} catch (err) {
  KitTypeBoxTransformer(err); // Throws KitHttpError with status 400 and issues
}
```

### 2. `fromTypeBoxError` (Non-throwing)

Converts a TypeBox validation error into a `KitHttpError` instance or returns `null` if the error is not a recognized TypeBox error.

```typescript
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { fromTypeBoxError } from "@wthek/typebox-transformer";

const errors = [...Value.Errors(UserSchema, data)];
const kitError = fromTypeBoxError(errors);

if (kitError) {
  // Handle or return response
  return ctx.json(kitError, kitError.statusCode ?? 400);
}
```

### With Options

```typescript
import { KitTypeBoxTransformer } from "@wthek/typebox-transformer";

try {
  Value.Assert(UserSchema, data);
} catch (err) {
  KitTypeBoxTransformer(err, {
    message: "Invalid payload provided",
    statusCode: 422, // Unprocessable Entity
  });
}
```

## Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `message` | `string` | `"TypeBox Validation Failed"` | Custom error message for the transformed error. |
| `statusCode` | `number` | `400` | Custom HTTP status code to assign to the validation error. |

### With Express / Fastify / Hono / Koa / NestJS

Use the transformer early in your error-handling pipeline — before applying framework-specific middleware like:

- [@wthek/express-middleware][@wthek/express-middleware]
- [@wthek/fastify-middleware][@wthek/fastify-middleware]
- [@wthek/hono-middleware][@wthek/hono-middleware]
- [@wthek/koa-middleware][@wthek/koa-middleware]
- [@wthek/nestjs-middleware][@wthek/nestjs-middleware]

This ensures validation errors are transformed into `http-error-kit` errors early, allowing WTHek middleware to handle them cleanly.

### Custom Formatting with `KitHttpErrorConfig`

```typescript
import { KitHttpErrorConfig } from "http-error-kit";

KitHttpErrorConfig.configureFormatter(
  (statusCode, message, details, ...args) => ({
    code: statusCode,
    msg: message,
    extra: details,
    traceId: args[0] || "0fcb44cb-4f09-4900-8c4f-73ddd37ffe0a",
  }),
);
```

## Explore More WTHek Extensions

The WTHek ecosystem continues to grow with new extensions to simplify error handling across various frameworks and libraries. Stay updated with the latest tools that integrate seamlessly with `http-error-kit`.

**Check out the official list of extensions**: [Official Extensions List](https://github.com/Skillnter/http-error-kit/wiki/Official-Extensions-List)

## People

The original author of the project is [Himanshu Bansal][skillnter]

## Donations

**This is all voluntary work**, so if you want to support my efforts you can:

- [Buy Me A Coffee](https://www.buymeacoffee.com/skillnter)
- [PayPal](https://www.paypal.me/skillnte)
- [GitHub Sponsors](https://github.com/sponsors/Skillnter)
- [Patreon](https://www.patreon.com/skillnter)
- [Open Collective](https://opencollective.com/skillnter)

You can also use crypto:

![BNB: 0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889](https://img.shields.io/badge/BNB-0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889-brightgreen)

![BTC: bc1p22h4nsad5d8ketyhuvf0vyva6unttxwzzqvkty5r839as0mlclgs72d3mf](https://img.shields.io/badge/BTC-bc1p22h4nsad5d8ketyhuvf0vyva6unttxwzzqvkty5r839as0mlclgs72d3mf-brightgreen)

![ETH: 0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889](https://img.shields.io/badge/ETH-0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889-brightgreen)

## License

`@wthek/typebox-transformer` project is open-sourced software licensed under the [MIT license](LICENSE) by [Himanshu Bansal][skillnter].

[skillnter]: https://github.com/Skillnter/
[http-error-kit]: https://www.npmjs.com/package/http-error-kit
[@wthek/express-middleware]: https://www.npmjs.com/package/@wthek/express-middleware
[@wthek/fastify-middleware]: https://www.npmjs.com/package/@wthek/fastify-middleware
[@wthek/hono-middleware]: https://www.npmjs.com/package/@wthek/hono-middleware
[@wthek/koa-middleware]: https://www.npmjs.com/package/@wthek/koa-middleware
[@wthek/nestjs-middleware]: https://www.npmjs.com/package/@wthek/nestjs-middleware
