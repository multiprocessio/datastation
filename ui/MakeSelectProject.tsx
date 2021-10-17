import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { MODE } from '../shared/constants';
import '../shared/polyfill';
import {
  GetProjectsRequest,
  GetProjectsResponse,
  MakeProjectRequest,
  MakeProjectResponse,
  OpenProjectRequest,
  OpenProjectResponse,
} from '../shared/rpc';
import { asyncRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Loading } from './components/Loading';
import { UrlStateContext } from './urlState';

export function MakeSelectProject() {
  const [projectNameTmp, setProjectNameTmp] = React.useState('');

  const { setState: setUrlState } = React.useContext(UrlStateContext);

  const [makeProjectError, setMakeProjectError] = React.useState('');
  async function makeProject(projectId: string) {
    try {
      await asyncRPC<MakeProjectRequest, MakeProjectResponse>('makeProject', {
        projectId,
      });
      setUrlState({ projectId });
    } catch (e) {
      setMakeProjectError(e.message);
    }
  }

  const [projects, setProjects] = React.useState<GetProjectsResponse | null>(
    null
  );
  React.useEffect(() => {
    async function load() {
      const projects = await asyncRPC<GetProjectsRequest, GetProjectsResponse>(
        'getProjects',
        null
      );
      setProjects(projects);
    }

    if (MODE === 'server' && !projects) {
      load();
    }
  }, []);

  async function openProject() {
    await asyncRPC<OpenProjectRequest, OpenProjectResponse>(
      'openProject',
      null
    );
    window.close();
  }

  if (MODE === 'server' && !projects) {
    return <Loading />;
  }

  return (
    <div className="project-name">
      <h1>New Project</h1>
      <p>Pick a name for this project to get started.</p>
      <div className="form-row">
        <Input
          value={projectNameTmp}
          label="Project name"
          onChange={(v) => setProjectNameTmp(v)}
        />
      </div>
      <div className="form-row">
        <Button
          type="primary"
          disabled={!projectNameTmp}
          onClick={() => makeProject(projectNameTmp)}
        >
          {projectNameTmp ? 'Go!' : 'Pick a name'}
        </Button>
      </div>
      {makeProjectError && <Alert type="error" children={makeProjectError} />}
      {MODE === 'desktop' && (
        <div className="project-existing">
          <p>Or open an existing project.</p>
          <div className="form-row">
            <Button onClick={openProject}>Open</Button>
          </div>
        </div>
      )}
      {MODE === 'server' && projects.length ? (
        <div className="project-existing">
          <p>Or open an existing project.</p>
          {projects.map(({ name, createdAt }) => (
            <div className="form-row">
              <h3>{name}</h3>
              <div>
                Created{' '}
                {formatDistanceToNow(new Date(createdAt), {
                  addSuffix: true,
                })}
              </div>
              <a href={'/?projectId=' + name}>Open</a>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
