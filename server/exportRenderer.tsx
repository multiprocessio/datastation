import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProjectState } from '../shared/state';
import { Dashboard } from '../ui/dashboard';
import { ProjectContext } from '../ui/ProjectStore';
import { UrlStateContext } from '../ui/urlState';

export function renderPage(project: ProjectState, pageId: string) {
  const page = project.pages.findIndex((p) => p.id === pageId);
  const view = (
    <ProjectContext.Provider value={{ state: project, setState: () => {} }}>
      <UrlStateContext.Provider
        value={{
          state: { page: page, projectId: project.id, view: 'dashboard' },
          setState: () => {},
        }}
      >
        <Dashboard />
      </UrlStateContext.Provider>
    </ProjectContext.Provider>
  );

  return renderToString(view);
}
