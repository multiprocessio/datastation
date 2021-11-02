const {
  ProjectState,
  ProjectPage,
  ScheduledExport,
  TablePanelInfo,
  ProgramPanelInfo,
  LiteralPanelInfo,
} = require('../shared/state');
const { main, Exporter } = require('./exporter');

const project = new ProjectState();
project.pages = [new ProjectPage()];
project.pages[0].panels = [
  new LiteralPanelInfo({
    content: JSON.stringify([
      { name: 'Kay', age: 12 },
      { name: 'Terry', age: 13 },
    ]),
  }),
  new ProgramPanelInfo({
    content: 'SELECT * FROM DM_getPanel(0)',
    language: 'sql',
  }),
  new TablePanelInfo({
    columns: ['name', 'age'],
  }),
];

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

test('getRenderer', () => {
  const e = new Exporter(null);
  e.getRenderer();
});

describe('main', () => {
  const handlers = [
    {
      resource: 'getProjects',
      handler: () => [project],
    },
    {
      resource: 'getProject',
      handler: () => project,
    },
  ];
  const transport = {
    sendMail: jest.fn(),
  };
  const nodemailer = {
    createTransport: jest.fn(() => transport),
  };
  main(handlers, nodemailer);
  test('createTransport calls', () =>
    expect(nodemailer.createTransport.mock.calls.length).toBe(1));
  test('transport calls', () =>
    expect(transport.sendMail.mock.calls.length).toBe(1));
});
