import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,

  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

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
  // ArchGuard Invariant Bans (frontend)
  // From: .knowledge/Universal/archguard-methodology.md §Part 4
  // Note: console.log is allowed in browser; process.env/exit don't apply
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

      // ── Ban 6: Empty catch blocks (FM4) ──
      "no-empty": ["error", { allowEmptyCatch: false }],

      // ── Ban 11: Floating promises (FM5/FM4) ──
      "@typescript-eslint/no-floating-promises": "error",

      // ── Ban 1: Raw `JSON.parse()` without Zod (FM1) ──
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
          message: "Ban 1: Raw JSON.parse() is FORBIDDEN. Use Zod.safeParse() for validated parsing at boundaries.",
        },
        // ── Ban 12: `export *` barrel exports (FM3) ──
        {
          selector: "ExportAllDeclaration",
          message: "Ban 12: export * is FORBIDDEN. Export named members explicitly to avoid leaking internals.",
        },
      ],

      // ── Ban 13: Mutable module-level state (FM6) ──
      "prefer-const": "error",
      "no-var": "error",
    },
  },

  // ──────────────────────────────────────────────────
  // ArchGuard Hygiene Rules (frontend)
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
  // Per-directory overrides
  // ──────────────────────────────────────────────────

  {
    // Ban 10 + 14: Non-deterministic primitives in lib/ (shared frontend logic) (FM7)
    // Date.now(), Math.random(), crypto.randomUUID()
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Ban 10: Date.now() is FORBIDDEN in lib/. Inject or wrap for testability.",
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: "Ban 14: Math.random() is FORBIDDEN in lib/. Use a seeded or injectable random source.",
        },
        {
          selector: "CallExpression[callee.object.name='crypto'][callee.property.name='randomUUID']",
          message: "Ban 14: crypto.randomUUID() is FORBIDDEN in lib/. Inject an ID generator.",
        },
      ],
    },
  },

  {
    ignores: ["dist/", "node_modules/", ".next/", "out/", "next.config.js"],
  },

  {
    // Whitelist: auth-context.tsx is allowed JSON.parse because it immediately
    // validates the result with Zod.safeParse (Ban 1 exception, same pattern as backend config.ts)
    files: ["src/lib/auth-context.tsx"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
