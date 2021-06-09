import * as React from 'react';

import { Page } from './Page';
import { ProjectState, ProjectPage } from './ProjectStore';
import { Button } from './component-library/Button';
import { Input } from './component-library/Input';

export function Pages({
  state,
  addPage,
  updatePage,
  setCurrentPage,
}: {
  state: ProjectState;
  addPage: (page: ProjectPage) => void;
  updatePage: (page: ProjectPage) => void;
  setCurrentPage: (pageIndex: number) => void;
}) {
  const page = state.pages[state.currentPage];

  return (
    <div className="section pages">
      <div className="section-title">
        <Input
          className="page-name page-name--current"
          onChange={(value: string) => updatePage({ ...page, name: value })}
          value={page.name}
        />
        {state.pages.map((page: ProjectPage, i: number) =>
          i === state.currentPage ? undefined : (
            <Button className="page-name" onClick={() => setCurrentPage(i)}>
              {page.name}
            </Button>
          )
        )}
        <Button
          type="primary"
          className="flex-right"
          onClick={() => {
            addPage({ name: 'Untitled page', panels: [] });
            setCurrentPage(state.pages.length - 1);
          }}
        >
          New Page
        </Button>
      </div>

      <Page page={page} updatePage={updatePage} />
    </div>
  );
}
