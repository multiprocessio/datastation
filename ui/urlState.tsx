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

export interface UrlState {
  projectId: string;
  page: number;
  view: 'editor' | 'dashboard' | 'scheduler';
  refreshPeriod?: number;
}

export function getUrlState(): UrlState {
  return {
    projectId: getQueryParameter('projectId'),
    page: +getQueryParameter('page') || 0,
    view: (getQueryParameter('view') || 'editor') as UrlState['view'],
  };
}

export function useUrlState(): [UrlState, (a0: Partial<UrlState>) => void] {
  const defaultState = getUrlState();
  const lastPageIndexKey = 'lastPageIndex:' + defaultState.projectId;
  const [state, setStateInternal] = React.useState<UrlState>({
    ...defaultState,
    page: defaultState.page || +localStorage.getItem(lastPageIndexKey) || 0,
  });

  React.useEffect(() => {
    const currentState = getUrlState();
    if (!deepEquals(currentState, state)) {
      const serialized = Object.keys(state)
        .map((k) => `${k}=${encodeURIComponent(state[k as keyof UrlState])}`)
        .join('&');
      const newUrl = window.location.pathname + '?' + serialized;
      history.pushState({}, document.title, newUrl);

      if (currentState.page !== state.page) {
        localStorage.setItem(lastPageIndexKey, String(state.page));
      }
    }
  });

  const setState = React.useCallback(
    function setState(newState: Partial<UrlState>) {
      setStateInternal({
        ...state,
        ...newState,
      });
    },
    [state, setStateInternal]
  );

  return [state, setState];
}

export const UrlStateContext = React.createContext<{
  state: UrlState;
  setState: (a: Partial<UrlState>) => void;
}>({
  state: getUrlState(),
  setState(a) {
    throw new Error('Context not initialized.');
  },
});
