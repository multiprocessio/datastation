module.exports = {
  // Only on linux do all tests run
  coverageThreshold:
    process.platform === 'linux'
      ? process.argv.includes('desktop/panel/credential_database.test.js')
        ? {
            global: {
              statements: 15,
              branches: 13,
              lines: 15,
              functions: 9,
            },
          }
        : {
            global: {
              statements: 54,
              branches: 43,
              functions: 37,
              lines: 55,
            },
          }
      : undefined,
  preset: 'ts-jest/presets/js-with-ts',
  transformIgnorePatterns: [
    'node_modules/(?!react-syntax-highlighter|refractor|node-fetch|fetch-blob)',
  ],
  setupFiles: ['./shared/polyfill.ts', './testsetup.js'],
  testEnvironment: 'node',
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  collectCoverageFrom: [
    'ui/**/*.ts',
    'ui/**/*.tsx',
    'shared/**/*.ts',
    'desktop/**/*.ts',
    'server/**/*.ts',
    'server/**/*.tsx',
  ],
  modulePathIgnorePatterns: ['<rootDir>/releases/', '<rootDir>/build/', 'ee/'],
};
