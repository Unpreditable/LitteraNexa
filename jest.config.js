/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
  moduleNameMapper: {
    // Mock obsidian since it's not available in test environment
    "^obsidian$": "<rootDir>/tests/__mocks__/obsidian.ts",
  },
  transform: {
    // 151002: ts-jest wants isolatedModules with Node16 modules, which would stop it type-checking
    // the tests. They compile to CommonJS and run fine without it.
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json", diagnostics: { ignoreCodes: [151002] } }],
  },
};
