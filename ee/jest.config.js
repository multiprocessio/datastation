// Copyright 2022 Multiprocess Labs LLC

module.exports = {
  // Only on linux do all tests run
  coverageThreshold:
    process.platform === 'linux'
      ? {
          global: {
            statements: 73,
            branches: 67,
            functions: 74,
            lines: 74,
          },
        }
      : undefined,
  preset: 'ts-jest/presets/js-with-ts',
  transformIgnorePatterns: [
    'node_modules/(?!react-syntax-highlighter|refractor|node-fetch|fetch-blob)',
  ],
  setupFiles: ['../shared/polyfill.ts', './testsetup.js'],
  testEnvironment: 'node',
  testEnvironmentOptions: {
    url: 'http://localhost/'
  },
  collectCoverageFrom: [
    'ui/**/*.ts',
    'ui/**/*.tsx',
    'shared/**/*.ts',
    'desktop/**/*.ts',
    'server/**/*.ts',
    'server/**/*.tsx',
  ],
  modulePathIgnorePatterns: ['<rootDir>/releases/', '<rootDir>/build/'],
};
