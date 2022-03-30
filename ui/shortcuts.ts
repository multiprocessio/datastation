import { useHotkeys } from 'react-hotkeys-hook';
import { UrlState } from './urlState';

export function useShortcuts(
  urlState: UrlState,
  setUrlState: (a0: Partial<UrlState>) => void
) {
  useHotkeys(
    'ctrl+tab',
    () => {
      if (urlState.view === 'editor') {
        setUrlState({ page: urlState.page + 1 });
      }
    },
    null,
    [urlState.page, setUrlState]
  );

  useHotkeys(
    'ctrl+shift+tab',
    () => {
      if (urlState.view === 'editor') {
        setUrlState({ page: urlState.page - 1 });
      }
    },
    null,
    [urlState.page, setUrlState]
  );
}
