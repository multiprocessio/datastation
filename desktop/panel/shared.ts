import { PanelInfo, ProjectState } from '../../shared/state';
import { Dispatch } from '../rpc';

export async function getProjectAndPanel(
  dispatch: Dispatch,
  projectId: string,
  panelId: string
) {
  if (!panelId) {
    throw new Error('No panel specified when trying to look up panel.');
  }
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
    throw new Error(`Unable to find panel: "${panelId.replace('"', '\\"')}".'`);
  }
  panelPage--; // Handle last loop ++ overshot
  return { panel, panelPage, project };
}
