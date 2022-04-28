import React from 'react';
import { deepEquals } from '../shared/object';

function getQueryParameter(param: string) {
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

export type DefaultView =
  | 'editor'
  | 'dashboard'
  | 'exports'
  | 'settings'
  | 'projects';

export interface UrlState<T extends DefaultView = DefaultView> {
  projectId: string;
  page: number;
  fullScreen?: string;
  view: T;
  expanded?: Array<string>;
  sidebar?: boolean;
  panelOut: { [id: string]: string };
  panelOutExpanded?: Array<string>;
}

export function getUrlState<
  T extends DefaultView = DefaultView
>(): UrlState<T> {
  return {
    projectId: getQueryParameter('projectId'),
    page: +getQueryParameter('page') || 0,
    fullScreen: getQueryParameter('fullScreen'),
    view: (getQueryParameter('view') || 'editor') as T,
    expanded: getQueryParameter('expanded').split(','),
    sidebar: getQueryParameter('sidebar') !== 'false',
    panelOutExpanded: getQueryParameter('panelOutExpanded').split(','),
    panelOut: JSON.parse(getQueryParameter('panelOutExpanded') || '{}'),
  };
}

const lsPrefix = 'urlstate:';

// TODO: how to clear state if this ever goes bad?
export function getDefaultState<
  T extends DefaultView = DefaultView
>(): UrlState<T> {
  const urlState = getUrlState<T>();
  const key = lsPrefix + urlState.projectId;
  try {
    const localStorageState: UrlState<T> = JSON.parse(
      localStorage.getItem(key) || '{}'
    );
    urlState.page = localStorageState.page || urlState.page;
    urlState.expanded = localStorageState.expanded || urlState.expanded;
    urlState.sidebar = localStorageState.sidebar || urlState.sidebar;
    urlState.panelOut = localStorageState.panelOut || urlState.panelOut;
    urlState.panelOutExpanded =
      localStorageState.panelOutExpanded || urlState.panelOutExpanded;
  } catch (e) {
    localStorage.setItem(key, '{}');
  }

  return urlState;
}

export function useUrlState<T extends DefaultView = DefaultView>(): [
  UrlState<T>,
  (a0: Partial<UrlState<T>>) => void
] {
  const defaultState = getDefaultState<T>();
  const [state, setStateInternal] = React.useState<UrlState<T>>(defaultState);

  React.useEffect(function compareUrlStates() {
    const currentState = getUrlState();
    if (!deepEquals(currentState, state)) {
      const serialized = Object.keys(state)
        .map(function mapKey(k) {
          const c = state[k as keyof UrlState];
          const s = k === 'panelOut' ? JSON.stringify(c) : String(c);
          return `${k}=${encodeURIComponent(s)}`;
        })
        .join('&');
      const newUrl = window.location.pathname + '?' + serialized;
      history.pushState({}, document.title, newUrl);
      localStorage.setItem(lsPrefix + state.projectId, JSON.stringify(state));
    }
  });

  const setState = React.useCallback(
    function setState(newState: Partial<UrlState<T>>) {
      setStateInternal({
        ...state,
        ...newState,
      });
    },
    [state, setStateInternal]
  );

  return [state, setState];
}

// TODO: how to parameterize this for ee?
export const UrlStateContext = React.createContext<{
  state: UrlState;
  setState: (a: Partial<UrlState>) => void;
}>({
  state: getUrlState(),
  setState(_a) {
    throw new Error('Context not initialized.');
  },
});
