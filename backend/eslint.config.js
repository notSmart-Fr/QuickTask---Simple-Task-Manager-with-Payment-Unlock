import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  eslintConfigPrettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        allowDefaultProject: ["eslint.config.js"],
      },
    },
  },

  // ──────────────────────────────────────────────────
  // ArchGuard Invariant Bans (backend)
  // From: .knowledge/Universal/archguard-methodology.md §Part 4
  // ──────────────────────────────────────────────────

  {
    rules: {
      // ── Ban 2: `any` type + `as any` (FM4) ──
      "@typescript-eslint/no-explicit-any": "error",

      // ── Ban 3: `@ts-ignore` / `@ts-nocheck` (FM4) ──
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],

      // ── Ban 4: `console.log/info/warn/debug` (FM3) ──
      // console.error is allowed for structured logging in main.ts
      "no-console": ["error", { allow: ["error"] }],

      // ── Ban 6: Empty catch blocks (FM4) ──
      "no-empty": ["error", { allowEmptyCatch: false }],

      // ── Ban 7: `process.exit()` (FM5) ──
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='process'][callee.property.name='exit']",
          message: "Ban 7: process.exit() is FORBIDDEN. Use graceful SIGTERM/SIGINT shutdown handlers per constitution §1.10.",
        },
        // ── Ban 1: Raw `JSON.parse()` without Zod (FM1) ──
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: "Ban 1: Raw JSON.parse() is FORBIDDEN. Use Zod.safeParse() for validated parsing at boundaries.",
        },
        // ── Ban 12: `export *` barrel exports (FM3) ──
        {
          selector: "ExportAllDeclaration",
          message: "Ban 12: export * is FORBIDDEN. Export named members explicitly to avoid leaking internals (constitution §3.7).",
        },
      ],

      // ── Ban 11: Floating promises (FM5/FM4) ──
      "@typescript-eslint/no-floating-promises": "error",

      // ── Ban 13: Mutable module-level state (FM6) ──
      // let/var at module scope is FORBIDDEN; const only
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // ──────────────────────────────────────────────────
  // ArchGuard Hygiene Rules (backend)
  // From: .knowledge/Universal/archguard-hygiene.md
  // ──────────────────────────────────────────────────

  {
    rules: {
      // ── H1: Cyclomatic Complexity (McCabe, 1976) ──
      "complexity": ["error", { max: 8 }],

      // ── H2: Nesting Depth (Pyramid of Doom) ──
      "max-depth": ["error", { max: 3 }],

      // ── H3: Function Length (Lipow, 1982) ──
      "max-lines-per-function": ["warn", {
        max: 75,
        skipBlankLines: true,
        skipComments: true,
      }],

      // ── H4: Unused Variables (Miller's Law — cognitive load) ──
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },

  // ──────────────────────────────────────────────────
  // Per-file overrides
  // ──────────────────────────────────────────────────

  {
    // Whitelist: config.ts is the ONLY file allowed to read process.env (Ban 9)
    files: ["src/config.ts"],
    rules: {
      "no-restricted-syntax": "off", // allows process.env + JSON.parse for config validation
      "no-console": "off", // config startup errors may use console
    },
  },

  {
    // Whitelist: main.ts is the ONLY file allowed process.exit (Ban 7) for shutdown
    files: ["src/main.ts"],
    rules: {
      "no-console": "off",
      "no-restricted-syntax": [
        "error",
        // Ban 1: Raw JSON.parse()
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: "Ban 1: Raw JSON.parse() is FORBIDDEN. Use Zod.safeParse().",
        },
        // Ban 12: export *
        {
          selector: "ExportAllDeclaration",
          message: "Ban 12: export * is FORBIDDEN.",
        },
        // process.exit allowed in main.ts only (not banned here)
        // Ban 9: process.env outside config (still banned in main.ts)
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "Ban 9: process.env is only allowed in src/config.ts. Import config from 'config.ts' instead.",
        },
      ],
    },
  },

  {
    // Ban 9: process.env outside config — banned everywhere except config.ts
    files: ["src/**/*.ts"],
    ignores: ["src/config.ts", "src/main.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Ban 1: Raw JSON.parse()
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: "Ban 1: Raw JSON.parse() is FORBIDDEN. Use Zod.safeParse().",
        },
        // Ban 7: process.exit()
        {
          selector: "CallExpression[callee.object.name='process'][callee.property.name='exit']",
          message: "Ban 7: process.exit() is FORBIDDEN. Use graceful shutdown handlers.",
        },
        // Ban 9: process.env outside config
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "Ban 9: process.env is only allowed in src/config.ts. Import the validated config object instead.",
        },
        // Ban 12: export *
        {
          selector: "ExportAllDeclaration",
          message: "Ban 12: export * is FORBIDDEN.",
        },
      ],
    },
  },

  {
    // Ban 10 + 14: Non-deterministic primitives in core/ (FM7)
    // Date.now(), new Date(), Math.random(), crypto.randomUUID()
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Ban 10: Date.now() is FORBIDDEN in core/. Inject a Clock abstraction for determinism per constitution §1.3.1.",
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Ban 10: new Date() is FORBIDDEN in core/. Inject a Clock abstraction for determinism per constitution §1.3.1.",
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "Ban 14: Math.random() is FORBIDDEN in core/. Inject an IdGenerator abstraction per constitution §1.3.1.",
        },
        {
          selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
          message: "Ban 14: crypto.randomUUID() is FORBIDDEN in core/. Inject an IdGenerator abstraction per constitution §1.3.1.",
        },
        // Also enforce the other bans in core/
        // Ban 1: JSON.parse
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: "Ban 1: Raw JSON.parse() is FORBIDDEN. Use Zod.safeParse().",
        },
        // Ban 7: process.exit
        {
          selector: "CallExpression[callee.object.name='process'][callee.property.name='exit']",
          message: "Ban 7: process.exit() is FORBIDDEN in core/.",
        },
        // Ban 9: process.env
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: "Ban 9: process.env is FORBIDDEN in core/. Domain logic must not depend on environment variables.",
        },
        // Ban 12: export *
        {
          selector: "ExportAllDeclaration",
          message: "Ban 12: export * is FORBIDDEN.",
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────
  // FM2: Composition Root Enforcement — ban adapter `new` outside main.ts
  // ──────────────────────────────────────────────────

  {
    files: ["src/**/*.ts"],
    ignores: ["src/main.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name=/^(PrismaUserRepository|PrismaTaskRepository|PrismaPaymentRepository|BcryptHasher|JwtToken|StripeGateway)$/]",
          message: "FM2 Violation: Adapter must NOT be instantiated outside main.ts (composition root). Inject pre-built services via constructor/function parameter instead.",
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────
  // Effect-TS: try/catch is FORBIDDEN in core/ and api/
  // Domain errors go through the Effect error channel (Data.TaggedError)
  // Routes use Effect.either + _tag matching — never try/catch
  // ──────────────────────────────────────────────────

  {
    files: ["src/core/**/*.ts", "src/api/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TryStatement",
          message: "try/catch is FORBIDDEN in core/ and api/. Use Effect.gen + Effect.tryPromise for async boundaries, and Effect.either + Either.isLeft for error matching in routes. See AGENTS.md §Effect-TS Rules.",
        },
      ],
    },
  },

  // ──────────────────────────────────────────────────
  // DB-Layer Bans (Prisma) — per archguard-methodology §Database-Layer Bans
  // ──────────────────────────────────────────────────

  {
    // Ban: Prisma $queryRaw / $executeRaw (FM1)
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name=/^\\$queryRaw|\\$executeRaw/]",
          message: "Prisma raw query ban: $queryRaw / $executeRaw is FORBIDDEN. Use type-safe Prisma query methods instead. Raw SQL bypasses type safety and allows SQL injection (FM1).",
        },
      ],
    },
  },

  {
    // .d.ts files use declare global namespace for type augmentation
    files: ["src/**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-namespace": ["error", { "allowDeclarations": true }],
    },
  },
  {
    // Relax no-unsafe rules for Prisma adapters until we run prisma generate
    files: ["src/adapters/prisma/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  {
    // Ignore config files and generated files
    ignores: ["dist/", "node_modules/", "prisma/migrations/"],
  }
);
