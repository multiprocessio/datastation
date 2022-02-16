import AsyncLock from 'async-lock';
import express from 'express';
import path from 'path';
import { CODE_ROOT } from '../desktop/constants';
import { RPCHandler } from '../desktop/rpc';
import { ProjectPage, ProjectState } from '../shared/state';
import { App } from './app';
import { authenticated, AuthRequestSession } from './auth';
import log from './log';
import { makeDispatch } from './rpc';

class Dashboard {
  app: App;
  handlers: RPCHandler<any, any>[];
  evaling: AsyncLock;
  constructor(app: App, handlers: RPCHandler<any, any>[]) {
    this.app = app;
    this.handlers = handlers;
    this.evaling = new AsyncLock();
  }

  getPage = async (req: AuthRequestSession): Promise<ProjectPage | null> => {
    const { projectId, pageId } = req.params;
    const getProjectHandler = this.handlers.find(
      (h) => h.resource === 'getProject'
    ).handler;
    const project: ProjectState = await getProjectHandler(
      null,
      { projectId },
      null,
      true
    );
    if (!project) {
      return null;
    }

    return (project.pages || []).find((p) => p.id === pageId);
  };

  canLoadPage = async (req: AuthRequestSession) => {
    const page = await this.getPage(req);
    if (!page || page.visibility === 'no-link') {
      return false;
    }

    if (page.visibility === 'private-link' && !authenticated(req)) {
      return false;
    }

    return true;
  };

  view = async (req: AuthRequestSession, rsp: express.Response) => {
    if (!this.canLoadPage(req)) {
      rsp.status(404);
      return;
    }

    rsp.sendFile(path.join(CODE_ROOT, '/build/index.html'));
    return;
  };

  evalPage = async (project: ProjectState, page: ProjectPage) => {
    const resultsMap = {};
    for (const panel of page.panels) {
      const evalHandler = this.handlers.find(
        (h) => h.resource === 'eval'
      ).handler;
      const dispatch = makeDispatch(this.handlers);
      results[panel.id] = await dispatch({
        resource: 'eval',
        body: { panelId: panel },
        projectId,
      });
    }

    await dispatch({
      resource: 'updateResults',
      projectId,
      results,
    });
  };

  data = async (req: AuthRequestSession, rsp: express.Response) => {
    if (!this.canLoadPage(req)) {
      rsp.status(404);
      return;
    }

    const page = await this.getPage(req);

    if (!this.evaling.isBusy()) {
      log.info('Considering eval run for ' + page.id);
      let oldestRun = new Date();
      for (const panel of page.panels) {
        if (panel.lastEdited < oldestRun) {
          oldestRun = panel.lastEdited;
        }

        if (panel.resultMeta && panel.resultMeta.lastRun < oldestRun) {
          oldestRun = panel.resultMeta.lastRun;
        }
      }

      // Minimum of 60 seconds, default to 1 hour.
      const refreshPeriod = Math.max(+page.refreshPeriod || 60 * 60, 60);
      oldestRun.setSeconds(oldestRun.getSeconds() + refreshPeriod);
      if (oldestRun < new Date()) {
        // Kick off a new run
        log.info('Starting eval run for ' + page.id);
        setTimeout(() => {
          this.evaling.acquire('eval', () =>
            this.evalPage(req.params.projectId, page)
          );
        }, 0);
      }
    }

    // Either way always return old data
    page.panels = page.panels.filter((p) =>
      ['table', 'dashboard'].includes(p.type)
    );
    rsp.json(page);
  };
}

export async function registerDashboard(
  uiPath: string,
  apiPath: string,
  app: App,
  handlers: RPCHandler<any, any>[]
) {
  const dashboard = new Dashboard(app, handlers);
  const pathSuffix = '/:projectId/:pageId';
  app.express.get(uiPath + pathSuffix, dashboard.view);
  app.express.get(apiPath + pathSuffix, dashboard.data);
}
