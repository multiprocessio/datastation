import fs from 'fs';
import { PanelBody } from '../../shared/rpc';
import { Dispatch, RPCHandler } from '../rpc';
import { getProjectResultsFile } from '../store';
import { getProjectAndPanel } from './shared';
import { EvalHandlerResponse } from './types';

// TODO: this needs to be ported to go
export const fetchResultsHandler: RPCHandler<PanelBody, EvalHandlerResponse> = {
  resource: 'fetchResults',
  handler: async function (
    projectId: string,
    body: PanelBody,
    dispatch: Dispatch
  ): Promise<EvalHandlerResponse> {
    const { panel } = await getProjectAndPanel(
      dispatch,
      projectId,
      body.panelId
    );

    // Maybe the only appropriate place to call this in this package?
    const projectResultsFile = getProjectResultsFile(projectId);
    // TODO: this is a 4GB file limit!
    const f = fs.readFileSync(projectResultsFile + panel.id);

    // Everything gets stored as JSON on disk. Even literals and files get rewritten as JSON.
    return { value: JSON.parse(f.toString()) };
  },
};
