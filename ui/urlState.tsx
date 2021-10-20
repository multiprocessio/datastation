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
  page: number;
  view: 'editor' | 'dashboard';
}

export function getUrlState(): URLState {
  return {
    projectId: getQueryParameter('projectId'),
    page: +getQueryParameter('page') || 0,
    view: getQueryParameter('view') as 'editor' | 'dashboard',
  };
}

export function useUrlState(): [URLState, (a0: Partial<URLState>) => void] {
  const defaultState = getUrlState();
  const lastPageIndexKey = 'lastPageIndex:' + defaultState.projectId;
  const [state, setStateInternal] = React.useState<URLState>({
    ...defaultState,
    page: defaultState.page || +localStorage.getItem(lastPageIndexKey) || 0,
  });

  React.useEffect(() => {
    const currentState = getUrlState();
    if (!deepEquals(currentState, state)) {
      const serialized = Object.keys(state)
        .map((k) => `${k}=${encodeURIComponent(state[k as keyof URLState])}`)
        .join('&');
      const newUrl = window.location.pathname + '?' + serialized;
      history.pushState({}, document.title, newUrl);

      if (currentState.page !== state.page) {
        localStorage.setItem(lastPageIndexKey, String(state.page));
      }
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

export const UrlStateContext = React.createContext<{
  state: URLState;
  setState: (a: Partial<URLState>) => void;
}>({
  state: getUrlState(),
  setState(a) {
    throw new Error('Context not initialized.');
  },
});
