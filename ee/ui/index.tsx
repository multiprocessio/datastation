import React from 'react';
import ReactDOM from 'react-dom';
import { App, defaultRoutes } from '../../ui/app';
import { DefaultView } from '../../ui/urlState';
import { History } from './History';

// SOURCE: https://stackoverflow.com/a/7995898/1507139
const isMobile = navigator.userAgent.match(
  /(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i
);

type EEView = DefaultView | & 'history';

function index() {
  const root = document.getElementById('root');
  if (document.location.pathname.startsWith('/dashboard')) {
    //ReactDOM.render(<ExternalDashboard />, root);
    return;
  }

  if (!isMobile) {
    const routes: Record<EEView, React.FC> = {
      history: History,
      ...defaultRoutes()
    };
    ReactDOM.render(<App routes={routes} />, root);
    return;
  }

  root.innerHTML = 'Please use a desktop web browser to view this app.';
}

index();
