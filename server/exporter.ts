import { decryptFields } from '../desktop/secret';
import { APP_NAME, DEBUG, VERSION } from '../shared/constants';
import { ProjectPage, ProjectState, ScheduledExport } from '../shared/state';
import { init } from './app';
import { renderPage } from './exportRenderer';
import log from './log';
import { makeDispatch } from './rpc';

log.info(APP_NAME, VERSION, DEBUG ? 'DEBUG' : '');

async function runAndSend(
  dispatch: ReturnType<makeDispatch>,
  [project, page, schedule]: [ProjectState, ProjectPage, ScheduledExport]
) {
  for (const panel of page.panels) {
    await dispatch({
      resource: 'eval',
      projectId: project.id,
      body: {
        panelId: panel.id,
      },
    });
  }

  const rendered = renderPage(project, page.id);

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
        pass: schedule.destination.password_encrpyt,
      },
    });

    await transporter.sendMail({
      from: schedule.destination.from,
      to: schedule.destination.to,
      subject: schedule.destination.name,
      html: rendered,
    });
  } else {
    log.info('Invalid schedule destination type ');
  }
}

function getScheduledExports(project: ProjectState[]) {
  const daily: Array<[ProjectState, ProjectPage, ScheduledExport]> = [];
  const weekly: Array<[ProjectState, ProjectPage, ScheduledExport]> = [];
  const monthly: Array<[ProjectState, ProjectPage, ScheduledExport]> = [];

  projects.forEach((project) => {
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
  });

  return { daily, monthly, weekly };
}

async function main() {
  const runServer = false;
  const handlers = await init(runServer);
  const dispatch = makeDispatch(handlers);

  const { handler: getProjects } = handlers.find(
    (h) => h.resource === 'getProjects'
  );

  const projects = await getProjects();

  const { daily, weekly, monthly } = getScheduledExports(projects);

  daily.forEach((e) => runAndSend(dispatch, e));

  const now = new Date();

  if (now.getDate() === 1) {
    weekly.forEach((e) => runAndSend(dispatch, e));
  }

  if (now.getDate() === 1) {
    monthly.forEach((e) => runAndSend(dispatch, e));
  }
}

main();
