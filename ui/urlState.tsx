import React from 'react';
import { deepEquals } from '../shared/object';

function getQueryParameter(param: String) {
  const query = window.location.search.substring(1);
  const vars = query.split('&');

  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (pair[0] === param) {
      return decodeURIComponent(pair[1]);
    }
  }

  return '';
}

interface URLState {
  projectId: string;
  pageId: string;
  view: 'editor' | 'dashboard';
}

export function getUrlState() {
  return {
    projectId: getQueryParameter('projectId'),
    pageId: getQueryParameter('pageId'),
    view: getQueryParameter('view'),
  };
}
const defaultState = getUrlState();

export function useUrlState(): [URLState, (a0: Partial<URLState>) => void] {
  const [state, setStateInternal] = React.useState<URLState>(defaultState);

  React.useEffect(() => {
    const currentState = getCurrentState();
    if (!deepEquals(currentState, state)) {
      const serialized = Object.keys(state)
        .map((k) => `${k}=${encodeURIComponent(state[k])}`)
        .join('&');
      const newUrl = window.location.pathname + '?' + serialized;
      history.pushState({}, document.title, newUrl);
    }
  });

  function setState(newState: Partial<URLState>) {
    setStateInternal({
      ...state,
      ...newState,
    });
  }

  return [state, setState];
}

export const UrlStateContext =
  React.createContext<{
    state: URLState;
    setState: (a: Partial<URLState>) => void;
  }>();
