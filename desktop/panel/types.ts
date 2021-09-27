import { PanelInfo, PanelInfoType } from '../../shared/state';

export type EvalHandlerResponse = {
  returnValue?: boolean;
  skipWrite?: boolean;
  value: any;
};

export type EvalHandlerExtra = {
  indexIdMap: Array<string>;
  indexShapeMap: Array<Shape>;
};

export function guardPanel<T>(panel: PanelInfo, type: PanelInfoType): T {
  if (panel.type !== type) {
    throw new Error(`Trying to eval http on ${panel.type} panel ${panel.id}.`);
  }

  return panel as T;
}
