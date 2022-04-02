import {
  IconCalendar,
  IconCode,
  IconFiles,
  IconLayoutDashboard,
  IconSettings,
} from '@tabler/icons';
import React from 'react';
import { MODE } from '../shared/constants';
import { Button } from './components/Button';
import { UrlState, UrlStateContext } from './urlState';

export function Navigation() {
  const {
    state: { projectId, view },
    setState: setUrlState,
  } = React.useContext(UrlStateContext);

  const pages = [
    {
      view: 'editor',
      title: 'Editor',
      icon: <IconCode />,
    },
    {
      view: 'dashboard',
      title: 'Dashboards',
      icon: <IconLayoutDashboard />,
    },
    {
      view: 'exports',
      title: 'Exports',
      icon: <IconCalendar />,
    },
    MODE === 'server'
      ? {
          view: 'projects',
          title: 'Switch project',
          icon: <IconFiles />,
        }
      : null,
    {
      view: 'settings',
      title: 'Settings',
      icon: <IconSettings />,
    },
  ].filter(Boolean) as {
    view: UrlState['view'];
    title: string;
    icon: JSX.Element;
  }[];

  return (
    <div className="navigation">
      {pages.map((page) => (
        <div
          key={page.title}
          className={`navigation-item ${
            view === page.view ? 'navigation-item--active' : ''
          }`}
          title={page.title}
        >
          <Button
            icon
            onClick={() => setUrlState({ view: page.view, page: 0, projectId })}
          >
            {page.icon}
          </Button>
        </div>
      ))}
    </div>
  );
}
