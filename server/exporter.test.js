const {
  ProjectState,
  ProjectPage,
  ScheduledExport,
  TablePanelInfo,
  PanelResultMeta,
} = require('../shared/state');
const { main, fetchAndRunAllExports, Exporter } = require('./exporter');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const tpi = new TablePanelInfo({
  columns: ['name', 'age'],
});
tpi.resultMeta = new PanelResultMeta({
  value: [
    { name: 'Kerry', age: 44 },
    { name: 'Monroe', age: 59 },
  ],
  lastRun: new Date(),
});
project.pages[0].panels = [tpi];

project.pages[0].schedules = [
  new ScheduledExport({
    destination: {
      type: 'email',
      from: 'test@test.com',
      recipients: 'test2@test.com',
      server: 'smtp.test.com',
    },
  }),
  new ScheduledExport({
    period: 'week',
    destination: {
      type: 'email',
      from: 'test8@test.com',
      recipients: 'test3@test.com',
      server: 'smtp2.test.com',
    },
  }),
  new ScheduledExport({
    period: 'month',
    destination: {
      type: 'email',
      from: 'test5@test.com',
      recipients: 'test9@test.com',
      server: 'smtp3.test.com',
    },
  }),
];

test('getScheduledExports', () => {
  const e = new Exporter(null);
  const { daily, weekly, monthly } = e.getScheduledExports(project);
  expect(daily).toStrictEqual([
    [project, project.pages[0], project.pages[0].schedules[0]],
  ]);
  expect(weekly).toStrictEqual([
    [project, project.pages[0], project.pages[0].schedules[1]],
  ]);
  expect(monthly).toStrictEqual([
    [project, project.pages[0], project.pages[0].schedules[2]],
  ]);
});

describe('fetchAndRunAllExports', () => {
  const handlers = [
    {
      resource: 'getProjects',
      handler: () => [project],
    },
    {
      resource: 'getProject',
      handler: () => project,
    },
    {
      resource: 'eval',
      handler: () => {},
    },
  ];
  const transport = {
    sendMail: jest.fn(),
  };
  const nodemailer = {
    createTransport: jest.fn(() => transport),
  };
  fetchAndRunAllExports(handlers, nodemailer, {
    daily: true,
    weekly: true,
    monthly: true,
  });
  test('createTransport calls', () =>
    expect(nodemailer.createTransport.mock.calls.length).toBe(3));
  test('transport calls', () =>
    expect(transport.sendMail.mock.calls.length).toBe(3));
});

test('main', async () => {
  const init = jest.fn(() => 'my handlers');
  const run = jest.fn();
  await main(init, run);
  const now = new Date();
  expect([...run.mock.calls[0]]).toStrictEqual([
    'my handlers',
    run.mock.calls[0][1], // nodemailer
    {
      daily: true,
      weekly: now.getDay() === 1,
      monthly: now.getDate() === 1,
    },
  ]);
});
