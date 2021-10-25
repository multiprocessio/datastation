import React from 'react';
import { ScheduledExport } from '../../shared/state';
import { Button } from '../components/Button';
import { ProjectContext } from '../ProjectStore';
import { UrlStateContext } from '../urlState';
import { Schedule } from './Schedule';

export function Scheduler() {
  const {
    state: { page: pageIndex },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);
  const { state: projectState, setState: setProjectState } =
    React.useContext(ProjectContext);
  const { schedules, name } = projectState.pages[pageIndex];

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
    <div className="main-body">
      <div className="section">
        <div className="section-title">
          Schedule Exports for {name}
          <span title="Enter editor mode">
            <Button icon onClick={() => setUrlState({ view: 'editor' })}>
              pencil
            </Button>
          </span>
        </div>
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
    </div>
  );
}
