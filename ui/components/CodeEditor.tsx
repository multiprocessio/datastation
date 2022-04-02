import debounce from 'lodash.debounce';
// organize-imports-ignore
// Must be loaded before other ace-builds imports
import AceEditor from 'react-ace';
// Enables Ctrl-f
import 'ace-builds/src-min-noconflict/ext-searchbox';
// Enables syntax highlighting
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-julia';
import 'ace-builds/src-min-noconflict/mode-python';
import 'ace-builds/src-min-noconflict/mode-r';
import 'ace-builds/src-min-noconflict/mode-ruby';
import 'ace-builds/src-min-noconflict/mode-sql';
// UI theme
import 'ace-builds/src-min-noconflict/theme-github';
import 'ace-builds/src-min-noconflict/theme-dracula';
import * as React from 'react';
// Shortcuts support, TODO: support non-emacs
// This steals Ctrl-a so this should not be a default
//import 'ace-builds/src-min-noconflict/keybinding-emacs';
import { SettingsContext } from '../Settings';
import { INPUT_SYNC_PERIOD } from './Input';
import { Tooltip } from './Tooltip';

export function registerDebouncedChangeHandler(
  editor: AceEditor,
  onChange: (v: string) => void,
  noDelay?: boolean
): () => void {
  const debounced = debounce(onChange, INPUT_SYNC_PERIOD);
  function listener(e: Event) {
    const v = String((e.target as HTMLInputElement).value).trim();
    if (noDelay) {
      onChange(v);
      return;
    }

    debounced(v);
  }

  editor.onChange(listener);
  return () => debounced.flush();
}

export function CodeEditor({
  value,
  onChange,
  className,
  placeholder,
  disabled,
  onKeyDown,
  language,
  id,
  singleLine,
  label,
  tooltip,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  language: string;
  id: string;
  singleLine?: boolean;
  label?: string;
  tooltip?: string;
}) {
  const {
    state: { theme },
  } = React.useContext(SettingsContext);

  const [editorNode, editorRef] = React.useState<AceEditor>(null);
  const flush = React.useRef<() => void>(() => {/* ignore */ });

  React.useEffect(() => {
    if (!editorNode) {
      return;
    }

    flush.current = registerDebouncedChangeHandler(
      editorNode,
      onChange,
    );
  }, [editorNode, onChange]);

  // Make sure editor resizes if the overall panel changes size. For
  // example this happens when the preview height changes.
  React.useEffect(() => {
    if (editorNode) {
      const panel = editorNode.editor.container.closest('.panel');
      const obs = new ResizeObserver(function handleEditorResize() {
        editorNode.editor?.resize();
      });
      obs.observe(panel);

      return () => obs.disconnect();
    }
  });

  return (
    <div
      className={`editor-container ${singleLine ? 'editor-container--singleLine vertical-align-center' : ''
        }`}
    >
      {label && <label className="label input-label">{label}</label>}
      <AceEditor
        ref={editorRef}
        mode={language}
        theme={theme === 'dark' ? 'dracula' : 'github'}
        maxLines={singleLine ? 1 : undefined}
        wrapEnabled={true}
        onBlur={flush.current}
        name={id}
        defaultValue={String(value)}
        placeholder={placeholder}
        className={`${className} ${singleLine ? 'input' : ''}`}
        readOnly={disabled}
        width={
          singleLine
            ? String(Math.max(300, String(value).length * 10)) + 'px'
            : '100%'
        }
        fontSize="1rem"
        commands={[
          // AceEditor wants commands in this way but outside here we
          // only support onKeyDown so doing this funky translation.
          {
            name: 'ctrl-enter',
            bindKey: { win: 'Ctrl-Enter', mac: 'Ctrl-Enter' },
            exec: () => {
              flush.current();
              // Give time to flush
              return setTimeout(() =>
                onKeyDown({
                  ctrlKey: true,
                  code: 'Enter',
                } as React.KeyboardEvent)
              );
            },
          },
          singleLine
            ? {
              name: 'disable newlines',
              bindKey: { win: 'Enter|Shift-Enter', mac: 'Enter|Shift-Enter' },
              exec: () => {
                /* do nothing */
              },
            }
            : undefined,
        ].filter(Boolean)}
        showGutter={!singleLine}
        setOptions={
          singleLine
            ? { showLineNumbers: false, highlightActiveLine: false }
            : undefined
        }
      />
      {tooltip && <Tooltip>{tooltip}</Tooltip>}
    </div>
  );
}
