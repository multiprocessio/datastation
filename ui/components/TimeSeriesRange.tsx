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
import { FormGroup } from './FormGroup';
import { Radio } from './Radio';
import { NONE, Select } from './Select';

export function TimeSeriesRange({
  range,
  shape,
  updateRange,
}: {
  range: TimeSeriesRangeT;
  shape?: Shape;
  updateRange: (r: TimeSeriesRangeT) => void;
}) {
  const setTab = (value: string) => {
    switch (value) {
      case 'relative':
        return updateRange({
          rangeType: value,
          relative: 'last-hour',
        });
      case 'fixed':
        return updateRange({
          rangeType: value,
          fixed: 'this-hour',
        });
      case 'absolute':
        return updateRange({
          rangeType: value,
          begin: subMinutes(new Date(), 15),
          end: new Date(),
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
    <FormGroup label="Time Range">
      <div className="form-row">
        <FieldPicker
          label="Timestamp Field"
          value={range.field}
          shape={shape}
          allowNone="None"
          onChange={(value: string) => {
            if (range.field === NONE) {
              range.field = '';
            } else {
              range.field = value;
            }
            updateRange(range);
          }}
        />
      </div>
      <div className="flex">
        <div className="form-row">
          <Radio
            disabled={Boolean(range.field)}
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
                  label="Begin"
                  value={range.end}
                  onChange={(v) => {
                    range.begin = v;
                    updateRange(range);
                  }}
                />
              </div>
              <div className="form-row">
                <Datetime
                  label="End"
                  value={range.end}
                  onChange={(v) => {
                    range.end = v;
                    updateRange(range);
                  }}
                />
              </div>
            </React.Fragment>
          )}
          {range.rangeType === 'relative' && (
            <React.Fragment>
              <Select
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
    </FormGroup>
  );
}
