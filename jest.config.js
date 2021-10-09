module.exports = {
  // Only on linux do all tests run
  coverageThreshold:
    process.platform === 'linux'
      ? {
          global: {
            statements: 63,
            branches: 52,
            functions: 54,
            lines: 59,
          },
        }
      : undefined,
  transform: {
    '.[jt]sx?$': [
      '@sucrase/jest-plugin',
      {
        sourcemap: true,
        loaders: {
          '.test.js': 'jsx',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!react-syntax-highlighter|refractor|node-fetch|fetch-blob)',
  ],
  setupFiles: ['./shared/polyfill.ts', './testsetup.js'],
  testURL: 'http://localhost/',
  testEnvironment: 'node',
  collectCoverageFrom: [
    'ui/**/*.ts',
    'ui/**/*.tsx',
    'shared/**/*.ts',
    'desktop/**/*.ts',
    'server/**/*.ts',
  ],
  modulePathIgnorePatterns: ['<rootDir>/releases/', '<rootDir>/build/'],
};
