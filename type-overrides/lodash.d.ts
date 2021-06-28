declare module 'lodash.throttle' {
  declare function throttle<Input, Output>(
    f: (...args: Input) => Output,
    t: number
  ): (...args: Input) => Output;
  export = throttle;
}
