const { format, subMinutes, subHours, startOfHour } = require('date-fns');
const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const {
  LiteralPanelInfo,
  FilterAggregatePanelInfo,
} = require('../../shared/state');
const { makeEvalHandler } = require('./eval');
const { withSavedPanels } = require('./testutil');

const lp = new LiteralPanelInfo({
  contentTypeInfo: { type: 'application/json' },
  content: JSON.stringify([
    { age: 19, name: 'Kate' },
    { age: 20, name: 'Bake' },
    { age: 5, name: 'Dima' },
    { age: 5, name: 'Fateh' },
    { age: 9, name: 'Fei' },
  ]),
});

test('filters no group', async () => {
  const vp = new FilterAggregatePanelInfo({
    filter: 'age > 10',
    sortOn: 'age',
  });

  let finished = false;
  const panels = [lp, vp];
  await withSavedPanels(
    panels,
    async (project) => {
      const panelValueBuffer = fs.readFileSync(
        getProjectResultsFile(project.projectName) + vp.id
      );
      expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual([
        { name: 'Bake', age: 20 },
        { name: 'Kate', age: 19 },
      ]);

      finished = true;
    },
    { evalPanels: true }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});

test('filters with group', async () => {
  const vp = new FilterAggregatePanelInfo({
    filter: 'age < 10',
    sortOn: 'Aggregate: count',
    groupBy: 'age',
    aggregateType: 'count',
  });

  let finished = false;
  const panels = [lp, vp];
  await withSavedPanels(
    panels,
    async (project) => {
      const panelValueBuffer = fs.readFileSync(
        getProjectResultsFile(project.projectName) + vp.id
      );
      expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual([
        { age: 5, count: 2 },
        { age: 9, count: 1 },
      ]);

      finished = true;
    },
    { evalPanels: true }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});

test('filters time range', async () => {
  const rows = [45, 6, 5, 14, 35].map((timeOffset) => ({
    time: subMinutes(new Date(), timeOffset).toISOString(),
    value: timeOffset,
  }));
  const lp = new LiteralPanelInfo({
    contentTypeInfo: { type: 'application/json' },
    content: JSON.stringify(rows),
  });

  const vp = new FilterAggregatePanelInfo({
    sortOn: 'time',
    range: {
      field: 'time',
      rangeType: 'relative',
      relative: 'last-15-minutes',
    },
  });

  let finished = false;
  const panels = [lp, vp];
  await withSavedPanels(
    panels,
    async (project) => {
      const panelValueBuffer = fs.readFileSync(
        getProjectResultsFile(project.projectName) + vp.id
      );
      expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual([
        rows[2],
        rows[1],
        rows[3],
      ]);

      finished = true;
    },
    { evalPanels: true }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});

test('group on time range', async () => {
  const rows = [45, 15, 80, 220, 5, 200, 35, 210, 100].map((timeOffset) => ({
    time: subMinutes(new Date(), timeOffset).toISOString(),
    value: timeOffset,
  }));
  const lp = new LiteralPanelInfo({
    contentTypeInfo: { type: 'application/json' },
    content: JSON.stringify(rows),
  });

  const vp = new FilterAggregatePanelInfo({
    sortOn: 'time',
    groupBy: 'time',
    aggregateType: 'count',
    windowInterval: '60',
  });

  let finished = false;
  const panels = [lp, vp];
  await withSavedPanels(
    panels,
    async (project) => {
      const panelValueBuffer = fs.readFileSync(
        getProjectResultsFile(project.projectName) + vp.id
      );

      const expected = [];
      for (const row of rows) {
        const hourStart = startOfHour(new Date(row.time));
        const existing = expected.findIndex((r) => r.time === hourStart);
        if (existing === -1) {
          expected.push({ time: hourStart, count: 0 });
          existing = expected.length - 1;
        }

        expected[existing].count++;
      }
      expected.sort((r) => r.time);
      expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual(
        expected.map((row) => ({
          ...row,
          time: format(row.time, 'yyyy-MM-dd HH:mm:ss'),
        }))
      );

      finished = true;
    },
    { evalPanels: true }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});
