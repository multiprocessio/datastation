import fs from 'fs';
import { Readable } from 'stream';
import { PanelInfo, PanelResult, ProjectState } from '../../shared/state';
import { Dispatch } from '../rpc';
import { getProjectResultsFile } from '../store';

export async function getProjectAndPanel(
  dispatch: Dispatch,
  projectId: string,
  panelId: string
) {
  const project =
    ((await dispatch({
      resource: 'getProject',
      projectId,
      body: { projectId },
    })) as ProjectState) || new ProjectState();
  let panelPage = 0;
  let panel: PanelInfo;
  for (; !panel && panelPage < (project.pages || []).length; panelPage++) {
    for (const p of project.pages[panelPage].panels || []) {
      if (p.id === panelId) {
        panel = p;
        break;
      }
    }
  }
  if (!panel) {
    throw new Error('Unable to find panel.');
  }
  panelPage--; // Handle last loop ++ overshot
  return { panel, panelPage, project };
}

export async function getPanelResult(
  dispatch: Dispatch,
  projectId: string,
  panelId: string,
  raw: true
): Promise<Readable>;
export async function getPanelResult(
  dispatch: Dispatch,
  projectId: string,
  panelId: string
): Promise<PanelResult>;
export async function getPanelResult(
  dispatch: Dispatch,
  projectId: string,
  panelId: string,
  raw?: boolean
): Promise<PanelResult | Readable> {
  if (raw === true) {
    const resultFile = getProjectResultsFile(projectId) + panelId;
    return await fs.createReadStream(resultFile);
  }

  return (await dispatch({
    resource: 'fetchResults',
    projectId,
    body: { panelId },
  })) as PanelResult;
}
