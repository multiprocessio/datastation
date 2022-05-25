import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import '../shared/polyfill';
import {
  GetProjectsRequest,
  GetProjectsResponse,
  MakeProjectRequest,
  MakeProjectResponse,
} from '../shared/rpc';
import { ProjectState } from '../shared/state';
import { asyncRPC } from './asyncRPC';
import { Alert } from './components/Alert';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Loading } from './components/Loading';
import { Select } from './components/Select';
import { SAMPLES } from './samples';

export function MakeSelectProject() {
  const [projectNameTmp, setProjectNameTmp] = React.useState('');
  const [sample, setSample] = React.useState(null);

  const [makeProjectError, setMakeProjectError] = React.useState('');
  async function makeProject(projectId: string) {
    try {
      let project: ProjectState = null;
      if (sample) {
        outer: for (const group of SAMPLES) {
          for (const groupSample of group.samples) {
            if (sample === groupSample.name) {
              project = groupSample.project(projectNameTmp);
              break outer;
            }
          }
        }
      }
      await asyncRPC<MakeProjectRequest, MakeProjectResponse>('makeProject', {
        projectId,
        project,
      });

      // So loading ui shows up while changing page.
      setProjects([]);
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

    if (!projects) {
      load();
    }
  }, [projects]);

  if (!projects) {
    return <Loading />;
  }

  return (
    <div className="project-name">
      <h1>New Project</h1>
      <p>Pick a name for this project to get started.</p>
      <div className="form-row">
        <Input
          noBuffer
          value={projectNameTmp}
          label="Project name"
          onChange={(v) => setProjectNameTmp(v)}
        />
      </div>
      <div className="form-row">
        <Select
          value={sample ? sample : 'null'}
          label="Create from sample"
          onChange={(v) => setSample(v === 'null' ? null : v)}
        >
          <option value="null">Blank, no sample</option>
          {SAMPLES.map((group) => {
            <optgroup key={group.name} label={group.name}>
              {group.samples.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </optgroup>;
          })}
        </Select>
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
      {projects.length ? (
        <div className="project-existing">
          <p>Or open an existing project.</p>
          {projects.map(({ name, createdAt }) => (
            <div className="form-row" key={name}>
              <h3 className="project-selector">{name}</h3>
              <div className="project-timestamp">
                Created{' '}
                {formatDistanceToNow(new Date(createdAt), {
                  addSuffix: true,
                })}
              </div>
              <a href={window.location.pathname + '?projectId=' + name}>Open</a>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
