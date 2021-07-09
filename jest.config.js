module.exports = {
  transform: {
    '^.+\\.tsx?$': 'esbuild-jest',
  },
  collectCoverageFrom: ['ui/**/*.ts', 'ui/**/*.tsx'],
};
