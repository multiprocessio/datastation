module.exports = {
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
  transformIgnorePatterns: ['node_modules/(?!react-syntax-highlighter)'],
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
