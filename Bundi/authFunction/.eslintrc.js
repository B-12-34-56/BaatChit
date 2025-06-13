module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "*.js" // Ignore all JavaScript files
  ],
  plugins: [
    "@typescript-eslint",
    "import"
  ],
  rules: {
    "import/no-unresolved": "off",
    "import/namespace": "off",
    "@typescript-eslint/no-explicit-any": "off",
    quotes: ["error", "double"],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
      node: {
        extensions: [".js", ".ts"]
      }
    },
  },
}; 