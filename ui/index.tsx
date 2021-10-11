import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './app';

// SOURCE: https://stackoverflow.com/a/7995898/1507139
const isMobile = navigator.userAgent.match(
  /(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i
);
if (!isMobile) {
  ReactDOM.render(<App />, document.getElementById('root'));
} else {
  document.getElementById('root').innerHTML =
    'Please use a desktop web browser to view this app.';
}
