module.exports = {
  transform: {
    '^.+\\.tsx?$': [
      'esbuild-jest',
      {
        sourcemap: true,
      },
    ],
  },
  setupFiles: ['./shared/polyfill.ts'],
  collectCoverageFrom: ['ui/**/*.ts', 'ui/**/*.tsx'],
};
