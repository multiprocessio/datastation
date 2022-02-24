import React from 'react';
import { ProjectPage, ScheduledExport } from '../../shared/state';
import { Button } from '../components/Button';
import { Schedule } from './Schedule';

export function Scheduler({
  page,
  updatePage,
  modeFeatures,
}: {
  page: ProjectPage;
  updatePage: (page: ProjectPage) => void;
  modeFeatures: { scheduledExports: boolean };
}) {
  const { schedules } = page;

  function addSchedule() {
    schedules.push(new ScheduledExport());
    updatePage(page);
  }

  function removeSchedule(id: string) {
    const at = schedules.findIndex((ps) => ps.id === id);
    schedules.splice(at, 1);
    updatePage(page);
  }

  function setSchedule(s: ScheduledExport) {
    const i = schedules.findIndex((ps) => ps.id === s.id);
    schedules[i] = s;
    updatePage(page);
  }

  if (!modeFeatures.scheduledExports) {
    return (
      <div className="section">
        <div className="text-center">
          This feature is only available in server mode.
        </div>
      </div>
    );
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
        <Button onClick={() => addSchedule()}>Add Scheduled Export</Button>
      </div>
    </div>
  );
}
