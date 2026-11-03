// Статичний аналіз: рекомендовані правила ESLint і typescript-eslint.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
    rules: {
      "no-console": "off",
      eqeqeq: "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
