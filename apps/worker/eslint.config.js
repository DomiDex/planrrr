import baseConfig from "@repo/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js"]
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  }
];