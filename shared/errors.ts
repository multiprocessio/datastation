export class NotAnArrayOfObjectsError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotAnArrayOfObjectsError';
  }
}
