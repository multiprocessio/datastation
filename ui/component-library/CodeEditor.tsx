// Enables Ctrl-f
import 'ace-builds/src-min-noconflict/ext-searchbox';
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-julia';
import 'ace-builds/src-min-noconflict/mode-python';
import 'ace-builds/src-min-noconflict/mode-r';
import 'ace-builds/src-min-noconflict/mode-ruby';
// Enables syntax highlighting
import 'ace-builds/src-min-noconflict/mode-sql';
// UI theme
import 'ace-builds/src-min-noconflict/theme-github';
import * as React from 'react';
import AceEditor from 'react-ace';
// Shortcuts support, TODO: support non-emacs
// This steals Ctrl-a so this should not be a default
//import 'ace-builds/src-min-noconflict/keybinding-emacs';
import { useDebouncedLocalState } from './Input';

export function CodeEditor({
  value,
  onChange,
  className,
  disabled,
  onKeyDown,
  language,
  id,
  singleLine,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  language: string;
  id: string;
  singleLine?: boolean;
}) {
  const [localValue, setLocalValue] = useDebouncedLocalState(value, onChange);

  return (
    <div className="editor-container">
      <AceEditor
        mode={language}
        theme="github"
        maxLines={singleLine ? 1 : undefined}
        onChange={setLocalValue}
        name={id}
        value={localValue}
        className={`${className} ${singleLine ? 'input' : ''}`}
        readOnly={disabled}
        width="100%"
        fontSize="1rem"
        commands={[
          // AceEditor wants commands in this way but outside here we
          // only support onKeyDown so doing this funky translation.
          {
            name: 'ctrl-enter',
            bindKey: { win: 'Ctrl-Enter', mac: 'Ctrl-Enter' },
            exec: () =>
              onKeyDown({
                ctrlKey: true,
                code: 'Enter',
              } as React.KeyboardEvent),
          },
          singleLine
            ? {
                name: 'disable newlines',
                bindKey: { win: 'Enter|Shift-Enter', mac: 'Enter|Shift-Enter' },
                // Do nothing
                exec: () => {},
              }
            : undefined,
        ].filter(Boolean)}
        showGutter={!singleLine}
        keyboardHandler="emacs"
        setOptions={
          singleLine
            ? { showLineNumbers: false, highlightActiveLine: false }
            : undefined
        }
      />
    </div>
  );
}
