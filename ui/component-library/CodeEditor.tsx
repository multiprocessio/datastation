import * as React from 'react';
import AceEditor from 'react-ace';
// UI theme
import 'ace-builds/src-min-noconflict/theme-github';
// Enables Ctrl-f
import 'ace-builds/src-min-noconflict/ext-searchbox';
// Enables syntax highlighting
import 'ace-builds/src-min-noconflict/mode-sql';
import 'ace-builds/src-min-noconflict/mode-javascript';
import 'ace-builds/src-min-noconflict/mode-ruby';
import 'ace-builds/src-min-noconflict/mode-julia';
import 'ace-builds/src-min-noconflict/mode-r';
import 'ace-builds/src-min-noconflict/mode-python';

export function CodeEditor({
  value,
  onChange,
  className,
  disabled,
  onKeyDown,
  language,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  language: string;
  id: string;
}) {
  return (
    <div className="editor-container">
      <AceEditor
        mode={language}
        theme="github"
        onChange={onChange}
        name={id}
        value={value}
        className={className}
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
        ]}
        showGutter={true}
        keyboardHandler="emacs"
      />
    </div>
  );
}
