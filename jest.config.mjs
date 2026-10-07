import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  maxWorkers: process.env.DATABASE_URL ? 1 : "50%",
});
