export type EvalHandlerResponse = {
  returnValue?: boolean;
  skipWrite?: boolean;
  stdout?: string;
  contentType?: string;
  value: any;
  size?: any;
  arrayCount?: any;
};
