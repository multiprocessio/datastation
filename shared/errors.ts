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
    this.name = 'InvalidDependentPanelError';
    this.message = `A dependent panel's results are not valid. Did you run panel #${panelSource}?`;
  }
}

export class NoResultError extends Error {
  constructor() {
    super();
    this.name = 'NoResultError';
    this.message =
      'This panel did not set any results. Did you call DM_setPanel($someValue)?';
  }
}

export const EVAL_ERRORS = [
  NotAnArrayOfObjectsError,
  InvalidDependentPanelError,
  NoResultError,
];
