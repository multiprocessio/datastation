function escapedPanelIdentifier(id: number | string) {
  return `[${String(id).replace(']', '\\]')}]`;
}

export class NotAnArrayOfObjectsError extends Error {
  targetPanelId: number | string;
  constructor(id: number | string) {
    super();
    this.name = 'NotAnArrayOfObjectsError';
    this.targetPanelId = id;
    this.message = `This panel requires an array of objects as input. Make sure panel ${escapedPanelIdentifier(
      id
    )} returns an array of objects.`;
  }

  static fromJSON(j: any) {
    return new NotAnArrayOfObjectsError(j.targetPanelId);
  }
}

export class InvalidDependentPanelError extends Error {
  targetPanelId: number | string;
  constructor(id: number | string) {
    super();
    this.name = 'InvalidDependentPanelError';
    this.targetPanelId = id;
    this.message = `A dependent panel's results are not valid. Did you run panel ${escapedPanelIdentifier(
      id
    )}?`;
  }

  static fromJSON(j: any) {
    return new InvalidDependentPanelError(j.targetPanelId);
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

export class NoConnectorError extends Error {
  constructor() {
    super();
    this.name = 'NoConnectorError';
    this.message = 'Without a data source this panel cannot be run.';
  }
}

export class Cancelled extends Error {
  constructor() {
    super();
    this.name = 'Cancelled';
    this.message = 'Cancelled panel evaluation.';
  }
}

export class UnsupportedError extends Error {
  constructor(msg: string) {
    super();
    this.name = 'UnsupportedError';
    this.message = msg;
  }

  static fromJSON(j: any) {
    return new InvalidDependentPanelError(j.message);
  }
}

export const EVAL_ERRORS = [
  NotAnArrayOfObjectsError,
  InvalidDependentPanelError,
  NoResultError,
  UnsupportedError,
  NoConnectorError,
  Cancelled,
];
