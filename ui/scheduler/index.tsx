import React from 'react';
import { ProjectPage, ScheduledExport } from '../../shared/state';
import { Button } from '../components/Button';
import { Schedule } from './Schedule';

export function Scheduler({
  page,
  updatePage,
  modeFeatures,
  pageIndex,
}: {
  page: ProjectPage;
  pageIndex: number;
  updatePage: (page: ProjectPage, index: number) => void;
  modeFeatures: { scheduledExports: boolean };
}) {
  const { schedules } = page;

  /* TODO: none of these are right. Need to update schedule directly. */
  function addSchedule() {
    schedules.push(new ScheduledExport());
    updatePage(page, pageIndex);
  }

  function removeSchedule(id: string) {
    const at = schedules.findIndex((ps) => ps.id === id);
    schedules.splice(at, 1);
    updatePage(page, pageIndex);
  }

  function setSchedule(s: ScheduledExport) {
    const i = schedules.findIndex((ps) => ps.id === s.id);
    schedules[i] = s;
    updatePage(page, pageIndex);
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
