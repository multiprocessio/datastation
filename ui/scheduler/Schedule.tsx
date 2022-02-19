import { IconTrash } from '@tabler/icons';
import React from 'react';
import { ScheduledExport } from '../../shared/state';
import { Button } from '../components/Button';
import { Confirm } from '../components/Confirm';
import { Input } from '../components/Input';
import { Password } from '../components/Password';
import { Select } from '../components/Select';

export function Schedule({
  schedule,
  setSchedule,
  removeSchedule,
}: {
  schedule: ScheduledExport;
  setSchedule: (s: ScheduledExport) => void;
  removeSchedule: (s: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head vertical-align-center">
        <Input
          label="Name"
          value={schedule.name}
          onChange={(name) => setSchedule({ ...schedule, name })}
        />

        <span title="Delete Panel">
          <Confirm
            onConfirm={() => removeSchedule(schedule.id)}
            message="delete this panel"
            action="Delete"
            render={(confirm: () => void) => (
              <Button icon onClick={confirm} type="outline">
                <IconTrash />
              </Button>
            )}
          />
        </span>
      </div>
      <div className="panel-body-container">
        <div className="panel-body">
          <div>
            <div className="panel-details">
              <div className="form-row">
                <Select
                  label="Frequency"
                  value={schedule.period}
                  onChange={(period) => {
                    schedule.period = period as ScheduledExport['period'];
                    setSchedule(schedule);
                  }}
                >
                  <option value="day">Every day</option>
                  <option value="week">Every Monday</option>
                  <option value="month">Every first day of month</option>
                </Select>
              </div>
              <div className="form-row">
                <Input
                  type="email"
                  label="From address"
                  placeholder="mila@big.co"
                  value={schedule.destination.from}
                  onChange={(from) => {
                    schedule.destination.from = from;
                    setSchedule(schedule);
                  }}
                />
              </div>
              <div className="form-row">
                <Input
                  type="string"
                  label="Recipient(s)"
                  placeholder="ted@big.co,marta@big.co"
                  value={schedule.destination.recipients}
                  onChange={(recipients) => {
                    schedule.destination.recipients = recipients;
                    setSchedule(schedule);
                  }}
                  tooltip="Separate multiple addresses with a comma"
                />
              </div>
              <div className="form-row">
                <Input
                  type="string"
                  label="SMTP Server"
                  placeholder="smtp.big.co:587"
                  value={schedule.destination.server}
                  onChange={(server) => {
                    schedule.destination.server = server;
                    setSchedule(schedule);
                  }}
                  tooltip="Separate host and port with a colon"
                />
              </div>
              <div className="form-row">
                <Input
                  type="string"
                  label="SMTP Username"
                  value={schedule.destination.username}
                  placeholder="smtp@big.co"
                  onChange={(username) => {
                    schedule.destination.username = username;
                    setSchedule(schedule);
                  }}
                />
              </div>
              <Password
                label="SMTP Password"
                onChange={(p) => {
                  schedule.destination.password_encrypt = p;
                  setSchedule(schedule);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
