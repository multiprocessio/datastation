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

export function MakeSelectProject() {
  const [projectNameTmp, setProjectNameTmp] = React.useState('');

  const [makeProjectError, setMakeProjectError] = React.useState('');
  async function makeProject(projectId: string) {
    try {
      await asyncRPC<MakeProjectRequest, MakeProjectResponse>('makeProject', {
        projectId,
      });

      window.location.href =
        window.location.pathname + '?projectId=' + projectId;
    } catch (e) {
      setMakeProjectError(e.message);
    }
  }

  const [projects, setProjects] = React.useState<GetProjectsResponse | null>(
    null
  );
  React.useEffect(() => {
    async function load() {
      const loaded = await asyncRPC<GetProjectsRequest, GetProjectsResponse>(
        'getProjects',
        null
      );
      setProjects(loaded);
    }

    if (MODE === 'server' && !projects) {
      load();
    }
  }, [projects]);

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
    <div className="card project-name">
      <h1>New Project</h1>
      <p>Pick a name for this project to get started.</p>
      <div className="form-row">
        <Input
          noDelay
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
          <h2>Existing project</h2>
          {projects.map(({ name, createdAt }) => (
            <div className="form-row" key={name}>
              <h3 className="project-selector">{name}</h3>
              <div className="project-timestamp">
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
