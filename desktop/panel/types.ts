import { Shape } from 'shape';
import { PanelInfo, PanelInfoType } from '../../shared/state';

export type EvalHandlerResponse = {
  returnValue?: boolean;
  skipWrite?: boolean;
  stdout?: string;
  contentType?: string;
  value: any;
  size?: any;
  arrayCount?: any;
};

export type EvalHandlerExtra = {
  idMap: Record<string | number, string>;
  idShapeMap: Record<string | number, Shape>;
};

export function guardPanel<T extends PanelInfo>(
  panel: PanelInfo,
  type: PanelInfoType
): T {
  if (panel.type !== type) {
    throw new Error(`Trying to eval http on ${panel.type} panel ${panel.id}.`);
  }

  return panel as T;
}
