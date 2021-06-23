declare module 'lodash.throttle' {
  declare function throttle<Input, Output>(
    f: () => void,
    t: number
  ): (...args: Input) => Output;
  export = throttle;
}
