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
      <div className="panel-head">
        <span className="panel-name">
          <Input
            label="Name"
            value={schedule.name}
            onChange={(name) => setSchedule({ ...schedule, name })}
          />
        </span>
        <span className="flex-right">
          <span title="Delete Panel">
            <Confirm
              onConfirm={() => removeSchedule(schedule.id)}
              message="delete this panel"
              action="Delete"
              render={(confirm: () => void) => (
                <Button icon onClick={confirm} type="outline">
                  delete
                </Button>
              )}
            />
          </span>
        </span>
      </div>
      <div className="panel-body-container">
        <div className="panel-body">
          <div className="form-row">
            <Select
              label="Frequency"
              value={schedule.period}
              onChange={(period) =>
                setSchedule({
                  ...schedule,
                  period: period as ScheduledExport['period'],
                })
              }
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
              onChange={(from) =>
                setSchedule({
                  ...schedule,
                  destination: { ...schedule.destination, from },
                })
              }
            />
          </div>
          <div className="form-row">
            <Input
              type="string"
              label="Recipient(s)"
              placeholder="ted@big.co,marta@big.co"
              onChange={(recipients) =>
                setSchedule({
                  ...schedule,
                  destination: { ...schedule.destination, recipients },
                })
              }
              tooltip="Separate multiple addresses with a comma"
            />
          </div>
          <div className="form-row">
            <Input
              type="string"
              label="SMTP Server"
              placeholder="smtp.big.co:587"
              onChange={(server) =>
                setSchedule({
                  ...schedule,
                  destination: { ...schedule.destination, server },
                })
              }
              tooltip="Separate host and port with a colon"
            />
          </div>
          <div className="form-row">
            <Input
              type="string"
              label="SMTP Username"
              placeholder="smtp@big.co"
              onChange={(username) =>
                setSchedule({
                  ...schedule,
                  destination: { ...schedule.destination, username },
                })
              }
            />
          </div>
          <Password
            label="SMTP Password"
            onChange={(password_encrypt) =>
              setSchedule({
                ...schedule,
                destination: { ...schedule.destination, password_encrypt },
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
