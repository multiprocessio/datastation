import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './app';
import { ExternalDashboard } from './ExternalDashboard';

// SOURCE: https://stackoverflow.com/a/7995898/1507139
const isMobile = navigator.userAgent.match(
  /(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i
);

function index() {
  const root = document.getElementById('root');
  if (document.location.pathname.startsWith('/dashboard')) {
    ReactDOM.render(<ExternalDashboard />, root);
    return;
  }

  if (!isMobile) {
    ReactDOM.render(<App />, root);
    return;
  }

  root.innerHTML = 'Please use a desktop web browser to view this app.';
}

index();
