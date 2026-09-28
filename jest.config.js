/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "<rootDir>/tests/unit/**/*.test.ts",
    "<rootDir>/tests/*.tests.ts"
  ],
  moduleNameMapper: {
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@infra/(.*)$": "<rootDir>/src/infra/$1",
    "^@validators/(.*)$": "<rootDir>/src/validators/$1",
    "^@interfaces/(.*)$": "<rootDir>/src/interfaces/$1",
    "^@cli/(.*)$": "<rootDir>/src/cli/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1"
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/cli/main.ts"],
  coverageDirectory: "coverage"
};