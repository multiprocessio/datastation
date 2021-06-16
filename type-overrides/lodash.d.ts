declare module 'lodash.debounce' {
  declare function debounce<Input, Output>(
    f: () => void,
    t: number
  ): (...args: Input) => Output;
  export = debounce;
}
