export class PanelPlayWarning extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PanelPlayWarning';
  }
}
