module.exports = {
  // Only on linux do all tests run
  coverageThreshold:
    process.platform === 'linux'
      ? {
          global: {
            statements: 55,
            branches: 41,
            functions: 36,
            lines: 55,
          },
        }
      : undefined,
  preset: 'ts-jest/presets/js-with-ts',
  transformIgnorePatterns: [
    'node_modules/(?!react-syntax-highlighter|refractor|node-fetch|fetch-blob)',
  ],
  setupFiles: ['../shared/polyfill.ts', '../testsetup.js'],
  testURL: 'http://localhost/',
  testEnvironment: 'node',
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
