import fs from 'fs';
import jsesc from 'jsesc';
import { preview } from 'preview';
import { shape } from 'shape';
import { getProjectResultsFile } from '../desktop/store';
import { getProjectAndPanel } from './shared';

async function run() {
  const { project, panel, panelPage } = await getProjectAndPanel(
    dispatch,
    projectId,
    body.panelId
  );

  const indexIdMap = project.pages[panelPage].panels.map((p) => p.id);
  const indexShapeMap = project.pages[panelPage].panels.map(
    (p) => p.resultMeta.shape
  );

  const evalHandler = EVAL_HANDLERS[panel.type];
  const res = await evalHandler(
    project,
    panel,
    {
      indexIdMap,
      indexShapeMap,
    },
    dispatch
  );

  // TODO: is it a problem panels like Program skip this escaping?
  // This library is important for escaping responses otherwise some
  // characters can blow up various panel processes.
  const json = jsesc(res.value, { quotes: 'double', json: true });

  if (!res.skipWrite) {
    const projectResultsFile = getProjectResultsFile(projectId);
    fs.writeFileSync(projectResultsFile + panel.id, json);
  }

  const s = shape(res.value);

  return {
    stdout: res.stdout || '',
    preview: preview(res.value),
    shape: s,
    value: res.returnValue ? res.value : null,
    size: json.length,
    arrayCount: s.kind === 'array' ? (res.value || []).length : null,
    contentType: res.contentType || 'application/json',
  };
}
