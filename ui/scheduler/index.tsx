import React from 'react';
import { ScheduledExport } from '../../shared/state';
import { Button } from '../components/Button';
import { ProjectContext } from '../ProjectStore';
import { UrlStateContext } from '../urlState';

export function Dashboard() {
  const {
    state: { page: pageIndex, refreshPeriod },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);
  const { state: projectState, setState: setProjectState } =
    React.useContext(ProjectContext);
  const { panels, name, schedules } = projectState.pages[pageIndex];

  function addSchedule() {
    schedules.push(new ScheduledExport());
    setProjectState(projectState);
  }

  function setSchedule(s: ScheduledExport) {
    const i = schedules.findIndex((s) => s.id === id);
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
          <Schedule setSchedule={setSchedule} schedule={s} key={s.id} />
        ))}
        <div className="text-center">
          <Button onClick={() => addSchedule()}>New Scheduled Export</Button>
        </div>
      </div>
    </div>
  );
}
