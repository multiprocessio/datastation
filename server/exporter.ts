import { JSDOM } from 'jsdom';
import nodemailer from 'nodemailer';
import { RPCHandler } from '../desktop/rpc';
import { decryptFields } from '../desktop/secret';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import { GetProjectsRequest, GetProjectsResponse } from '../shared/rpc';
import { ProjectPage, ProjectState, ScheduledExport } from '../shared/state';
import { init } from './app';
import log from './log';
import { makeDispatch } from './rpc';

log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

function getRenderer() {
  // First set up virtual DOM
  const jsdom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
  });
  const { window } = jsdom;

  function copyProps(src: any, target: any) {
    Object.defineProperties(target, {
      ...Object.getOwnPropertyDescriptors(src),
      ...Object.getOwnPropertyDescriptors(target),
    });
  }

  (global as any).window = window;
  global.document = window.document;
  global.requestAnimationFrame = function (callback) {
    return setTimeout(callback, 0);
  };
  global.cancelAnimationFrame = function (id) {
    clearTimeout(id);
  };
  copyProps(window, global);
  window.DATASTATION_IS_EXPORT = true;

  // Then do the React stuff
  const { renderPage } = require('./exportRenderer');
  return renderPage;
}

async function runAndSend(
  dispatch: ReturnType<typeof makeDispatch>,
  [project, page, schedule]: [ProjectState, ProjectPage, ScheduledExport]
) {
  log.info(
    `Evaluating page "${page.name}" for export "${schedule.name} in project "${project.projectName}"`
  );
  for (const panel of page.panels) {
    await dispatch({
      resource: 'eval',
      projectId: project.projectName,
      body: {
        panelId: panel.id,
      },
    });
  }

  const rendered = getRenderer()(project, page.id);

  decryptFields(schedule.destination);

  if (schedule.destination.type === 'email') {
    const split = schedule.destination.server.split(':');
    const port = parseInt(split.length ? split.pop() : '') || 487;
    const host = split.join(':');
    const transporter = nodemailer.createTransport({
      host,
      port,
      auth: {
        user: schedule.destination.username,
        pass: schedule.destination.password_encrypt.value,
      },
    });

    await transporter.sendMail({
      from: schedule.destination.from,
      to: schedule.destination.recipients,
      subject: schedule.name,
      html: rendered,
    });

    log.info('Completed scheduled export: ' + schedule.name);
  } else {
    log.info('Invalid schedule destination type ');
  }
}

function getScheduledExports(project: ProjectState) {
  const daily: Array<[ProjectState, ProjectPage, ScheduledExport]> = [];
  const weekly: Array<[ProjectState, ProjectPage, ScheduledExport]> = [];
  const monthly: Array<[ProjectState, ProjectPage, ScheduledExport]> = [];

  project.pages.forEach((page) => {
    page.schedules.forEach((s) => {
      if (s.period === 'day') {
        daily.push([project, page, s]);
      } else if (s.period === 'week') {
        weekly.push([project, page, s]);
      } else if (s.period === 'month') {
        monthly.push([project, page, s]);
      } else {
        log.info('Skipping unknown period for scheduled export: ' + s.id);
      }
    });
  });

  return { daily, monthly, weekly };
}

async function main() {
  const runServer = false;
  const handlers = await init(runServer);
  const dispatch = makeDispatch(handlers);

  // It really sucks that this is untyped at this point.
  const { handler: getProjects } = handlers.find(
    (h) => h.resource === 'getProjects'
  ) as RPCHandler<GetProjectsRequest, GetProjectsResponse>;

  const projects = await getProjects(null, null, null, null);

  for (const { name } of projects) {
    const project = await dispatch({
      resource: 'getProject',
      projectId: name,
      body: {
        projectId: name,
      },
    });

    const { daily, weekly, monthly } = getScheduledExports(project);
    daily.forEach((e) => runAndSend(dispatch, e));

    const now = new Date();

    if (now.getDate() === 1) {
      weekly.forEach((e) => runAndSend(dispatch, e));
    }

    if (now.getDate() === 1) {
      monthly.forEach((e) => runAndSend(dispatch, e));
    }
  }
}

if (process.argv.map(a => a.includes('exporter.js'))) {
  main();
}
