module.exports = {
  transform: {
    '^.+\\.tsx?$': 'esbuild-jest',
  },
  setupFiles: ['./shared/polyfill.ts'],
  collectCoverageFrom: ['ui/**/*.ts', 'ui/**/*.tsx'],
};
