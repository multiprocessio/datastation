module.exports = {
  // Only on linux do all tests run
  coverageThreshold:
    process.platform === 'linux'
      ? {
          global: {
            statements: 66,
            branches: 56,
            functions: 56,
            lines: 66,
          },
        }
      : undefined,
  preset: 'ts-jest/presets/js-with-ts',
  transformIgnorePatterns: [
    'node_modules/(?!react-syntax-highlighter|refractor|node-fetch|fetch-blob)',
    //'@datastation/.+\\.(j|t)sx?$'
  ],
  moduleNameMapper: {
    '^@datastation/(.*)$': '<rootDir>/$1/',
  },
  setupFiles: ['./shared/polyfill.ts', './testsetup.js'],
  testURL: 'http://localhost/',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'ui/**/*.ts',
    'ui/**/*.tsx',
    'shared/**/*.ts',
    'desktop/**/*.ts',
    'runner/**/*.ts',
    'server/**/*.ts',
    'server/**/*.tsx',
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/releases/',
    '<rootDir>/build/',
    'ui/build/',
    'desktop/build/',
  ],
};
