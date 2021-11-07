import React from 'react';
import { ProjectState, ScheduledExport } from '../../shared/state';
import { Button } from '../components/Button';
import { ProjectContext } from '../ProjectStore';
import { UrlState, UrlStateContext } from '../urlState';
import { Schedule } from './Schedule';

export function SchedulerWithDeps({
  projectState,
  setProjectState,
  urlState: { page: pageIndex },
  setUrlState,
}: {
  projectState: ProjectState;
  setProjectState: (a: ProjectState) => void;
  urlState: UrlState;
  setUrlState: (a: Partial<UrlState>) => void;
}) {
  const { schedules } = projectState.pages[pageIndex];

  function addSchedule() {
    schedules.push(new ScheduledExport());
    setProjectState(projectState);
  }

  function removeSchedule(id: string) {
    const at = schedules.findIndex((ps) => ps.id === id);
    schedules.splice(at, 1);
    setProjectState(projectState);
  }

  function setSchedule(s: ScheduledExport) {
    const i = schedules.findIndex((ps) => ps.id === s.id);
    schedules[i] = s;
    setProjectState(projectState);
  }

  return (
    <div className="section">
      {schedules.map((s) => (
        <Schedule
          setSchedule={setSchedule}
          schedule={s}
          key={s.id}
          removeSchedule={removeSchedule}
        />
      ))}
      <div className="text-center">
        <Button onClick={() => addSchedule()}>New Scheduled Export</Button>
      </div>
    </div>
  );
}

export function Scheduler() {
  const { state: urlState, setState: setUrlState } =
    React.useContext(UrlStateContext);
  const { state: projectState, setState: setProjectState } =
    React.useContext(ProjectContext);
  return (
    <SchedulerWithDeps
      projectState={projectState}
      setProjectState={setProjectState}
      urlState={urlState}
      setUrlState={setUrlState}
    />
  );
}
