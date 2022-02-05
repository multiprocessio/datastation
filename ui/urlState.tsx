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
  fullScreen?: string;
  view: 'editor' | 'dashboard' | 'scheduler' | 'settings';
  refreshPeriod?: number;
  expanded?: Array<string>;
  sidebar?: boolean;
}

export function getUrlState(): UrlState {
  return {
    projectId: getQueryParameter('projectId'),
    page: +getQueryParameter('page') || 0,
    fullScreen: getQueryParameter('fullScreen'),
    view: (getQueryParameter('view') || 'editor') as UrlState['view'],
    expanded: getQueryParameter('expanded').split(','),
    sidebar: getQueryParameter('sidebar') !== 'false',
  };
}

const lsPrefix = 'urlstate:';

// TODO: how to clear state if this ever goes bad?
export function getDefaultState(): UrlState {
  const urlState = getUrlState();
  const key = lsPrefix + urlState.projectId;
  try {
    const localStorageState: UrlState = JSON.parse(
      localStorage.getItem(key) || '{}'
    );
    urlState.page = localStorageState.page || urlState.page;
    urlState.expanded = localStorageState.expanded || urlState.expanded;
    urlState.sidebar = localStorageState.sidebar || urlState.sidebar;
  } catch (e) {
    localStorage.setItem(key, '{}');
  }

  return urlState;
}

export function useUrlState(): [UrlState, (a0: Partial<UrlState>) => void] {
  const defaultState = getDefaultState();
  const [state, setStateInternal] = React.useState<UrlState>(defaultState);

  React.useEffect(function compareUrlStates() {
    const currentState = getUrlState();
    if (!deepEquals(currentState, state)) {
      const serialized = Object.keys(state)
        .map(function mapKey(k) {
          return `${k}=${encodeURIComponent(String(state[k as keyof UrlState]))}`;
        })
        .join('&');
      const newUrl = window.location.pathname + '?' + serialized;
      history.pushState({}, document.title, newUrl);
      localStorage.setItem(lsPrefix + state.projectId, JSON.stringify(state));
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
