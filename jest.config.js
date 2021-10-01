module.exports = {
  transform: {
    '.[jt]sx?$': [
      'esbuild-jest',
      {
        sourcemap: true,
        loaders: {
          '.test.js': 'jsx',
        },
      },
    ],
  },
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
