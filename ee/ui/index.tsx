// Copyright 2022 Multiprocess Labs LLC

import { IconHistory } from '@tabler/icons';
import React from 'react';
import ReactDOM from 'react-dom';
import { App, defaultRoutes } from '../../ui/app';
import { History } from './History';

// SOURCE: https://stackoverflow.com/a/7995898/1507139
const isMobile = navigator.userAgent.match(
  /(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i
);

function index() {
  const root = document.getElementById('root');
  if (document.location.pathname.startsWith('/dashboard')) {
    //ReactDOM.render(<ExternalDashboard />, root);
    return;
  }

  if (!isMobile) {
    const routes = [...defaultRoutes()];
    // Place last before settings
    routes.splice(routes.length - 1, 0, {
      endpoint: 'history',
      view: History,
      title: 'History',
      icon: IconHistory,
    });
    ReactDOM.render(<App routes={routes} />, root);
    return;
  }

  root.innerHTML = 'Please use a desktop web browser to view this app.';
}

index();
