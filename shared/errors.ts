export class NotAnArrayOfObjectsError extends Error {
  constructor(panelSource: number) {
    super();
    this.name = 'NotAnArrayOfObjectsError';
    this.message = `This panel requires an array of objects as input. Make sure panel #${panelSource} returns an array of objects.`;
  }
}

export class InvalidDependentPanelError extends Error {
  constructor(panelSource: number) {
    super();
    this.name = 'DependentPanelNotRunError';
    this.message = `A dependent panel results are not valid. Have you run panel #${panelSource}?`;
  }
}

export const EVAL_ERRORS = [
  NotAnArrayOfObjectsError,
  InvalidDependentPanelError,
];
