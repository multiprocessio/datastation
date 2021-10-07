import subMinutes from 'date-fns/subMinutes';
import * as React from 'react';
import { Shape } from 'shape';
import {
  TimeSeriesFixedTimes,
  TimeSeriesRange as TimeSeriesRangeT,
  TimeSeriesRelativeTimes,
} from '../../shared/state';
import { title } from '../../shared/text';
import { Datetime } from './Datetime';
import { FieldPicker } from './FieldPicker';
import { Radio } from './Radio';
import { NONE, Select } from './Select';

export function TimeSeriesRange({
  range,
  shape,
  hideField,
  updateRange,
}: {
  range: TimeSeriesRangeT;
  hideField?: boolean;
  shape?: Shape;
  updateRange: (r: TimeSeriesRangeT) => void;
}) {
  const setTab = (value: string) => {
    switch (value) {
      case 'relative':
        return updateRange({
          field: range.field,
          rangeType: value,
          relative: 'last-hour',
        });
      case 'fixed':
        return updateRange({
          field: range.field,
          rangeType: value,
          fixed: 'this-hour',
        });
      case 'absolute':
        return updateRange({
          field: range.field,
          rangeType: value,
          begin_date: subMinutes(new Date(), 15),
          end_date: new Date(),
        });
    }
  };

  const relativeOptions: Array<{
    label: string;
    options: Array<TimeSeriesRelativeTimes>;
  }> = [
    {
      label: 'Within day',
      options: [
        'last-5-minutes',
        'last-15-minutes',
        'last-30-minutes',
        'last-hour',
        'last-3-hours',
        'last-6-hours',
        'last-12-hours',
      ],
    },
    {
      label: 'Within month',
      options: ['last-day', 'last-3-days', 'last-week', 'last-2-weeks'],
    },
    {
      label: 'Within year',
      options: [
        'last-month',
        'last-2-months',
        'last-3-months',
        'last-6-months',
      ],
    },
    {
      label: 'Rest of time',
      options: ['last-year', 'last-2-years', 'all-time'],
    },
  ];

  const fixedOptions: Array<{
    label: string;
    options: Array<TimeSeriesFixedTimes>;
  }> = [
    {
      label: 'Within day',
      options: ['this-hour', 'previous-hour'],
    },
    {
      label: 'Within month',
      options: [
        'today',
        'yesterday',
        'week-to-date',
        'previous-week',
        'month-to-date',
      ],
    },
    {
      label: 'Rest of time',
      options: [
        'previous-month',
        'quarter-to-date',
        'previous-quarter',
        'year-to-date',
        'previous-year',
      ],
    },
  ];

  return (
    <React.Fragment>
      {!hideField && (
        <div className="form-row">
          <FieldPicker
            label="Timestamp Field"
            value={range.field}
            shape={shape}
            allowNone="None"
            onChange={(value: string) => {
              if (value === NONE) {
                range.field = '';
              } else {
                range.field = value;
              }
              updateRange(range);
            }}
          />
        </div>
      )}
      <div className="flex">
        <div className="form-row">
          <Radio
            disabled={!range.field}
            vertical
            name="range-type"
            value={range.rangeType}
            onChange={setTab}
            options={[
              { value: 'relative', label: 'Relative' },
              { value: 'fixed', label: 'Fixed' },
              { value: 'absolute', label: 'Absolute' },
            ]}
          />
        </div>

        <div className="form-row flex flex--vertical items-flex-end">
          {range.rangeType === 'absolute' && (
            <React.Fragment>
              <div className="form-row">
                <Datetime
                  disabled={!range.field}
                  label="Begin"
                  value={range.end_date}
                  onChange={(v) => {
                    range.begin_date = v;
                    updateRange(range);
                  }}
                />
              </div>
              <div className="form-row">
                <Datetime
                  label="End"
                  disabled={!range.field}
                  value={range.end_date}
                  onChange={(v) => {
                    range.end_date = v;
                    updateRange(range);
                  }}
                />
              </div>
            </React.Fragment>
          )}
          {range.rangeType === 'relative' && (
            <React.Fragment>
              <Select
                disabled={!range.field}
                value={range.relative}
                onChange={(id) => {
                  range.relative = id as TimeSeriesRelativeTimes;
                  updateRange(range);
                }}
                children={relativeOptions.map((group) => (
                  <optgroup label={group.label} key={group.label}>
                    {group.options.map((id) => (
                      <option value={id} key={id}>
                        {title(id)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              />
            </React.Fragment>
          )}

          {range.rangeType === 'fixed' && (
            <React.Fragment>
              <Select
                disabled={!range.field}
                onChange={(id) => {
                  range.fixed = id as TimeSeriesFixedTimes;
                  updateRange(range);
                }}
                value={range.fixed}
                children={fixedOptions.map((group) => (
                  <optgroup label={group.label} key={group.label}>
                    {group.options.map((id) => (
                      <option value={id} key={id}>
                        {title(id)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              />
            </React.Fragment>
          )}
        </div>
      </div>
    </React.Fragment>
  );
}
