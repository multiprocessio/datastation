import log from '../../shared/log';
import { useDebouncedCallback } from 'use-debounce';
import * as React from 'react';
import { SettingsContext } from '../Settings';
import { Tooltip } from './Tooltip';
import { INPUT_SYNC_PERIOD } from './Input';

// Must be loaded before other ace-builds imports
import AceEditor from 'react-ace';
// organize-imports-ignore
import { Ace } from 'ace-builds';
import ace from 'ace-builds/src-min-noconflict/ace';
import langTools from 'ace-builds/src-min-noconflict/ext-language_tools';
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
// Shortcuts support, TODO: support non-emacs
// This steals Ctrl-a so this should not be a default
//import 'ace-builds/src-min-noconflict/keybinding-emacs';

const AUTOCOMPLETE_MAP: Record<
  string,
  (
    tokenIteratorFactory: () => Ace.TokenIterator,
    prefix: string
  ) => Array<Ace.Completion>
> = {};

export function CodeEditor({
  value,
  onChange,
  className,
  placeholder,
  disabled,
  onKeyDown,
  autocomplete,
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
  autocomplete?: (
    tokenIteratorFactory: () => Ace.TokenIterator,
    prefix: string
  ) => Array<Ace.Completion>;
  language: string;
  id: string;
  singleLine?: boolean;
  label?: string;
  tooltip?: string;
}) {
  const {
    state: { theme, autocompleteDisabled },
  } = React.useContext(SettingsContext);

  if (autocomplete) {
    AUTOCOMPLETE_MAP[id] = autocomplete;
  }

  const [editorRef, setEditorRef] = React.useState<AceEditor>(null);
  const debounced = useDebouncedCallback(onChange, INPUT_SYNC_PERIOD);
  // Flush on unmount
  React.useEffect(
    () => () => {
      debounced.flush();
    },
    [debounced]
  );

  // Make sure editor resizes if the overall panel changes size. For
  // example this happens when the preview height changes.
  React.useEffect(() => {
    if (!editorRef) {
      return;
    }

    const panel = editorRef.editor.container.closest('.panel');
    const obs = new ResizeObserver(function handleEditorResize() {
      editorRef.editor?.resize();
    });
    obs.observe(panel);

    return () => obs.disconnect();
  }, [editorRef]);

  // Resync value when outer changes
  React.useEffect(() => {
    if (!editorRef || value == editorRef.editor.getValue()) {
      return;
    }

    // Without this the clearSelection call below moves the cursor to the end of the textarea destroying in-action edits
    if (editorRef.editor.container.contains(document.activeElement)) {
      return;
    }

    editorRef.editor.setValue(value);
    // setValue() also highlights the inserted values so this gets rid
    // of the highlight. Kind of a weird API really
    editorRef.editor.clearSelection();
  }, [value, editorRef]);

  React.useEffect(() => {
    if (!autocomplete) {
      return;
    }

    const { TokenIterator } = ace.require('ace/token_iterator');

    const completer = {
      getCompletions: (
        editor: AceEditor,
        session: Ace.EditSession,
        pos: Ace.Point,
        prefix: string,
        callback: Ace.CompleterCallback
      ) => {
        // This gets set/called in a global context so we need to figure out which panel is actually calling it.
        try {
          const factory = () => new TokenIterator(session, pos.row, pos.column);
          const autocomplete = AUTOCOMPLETE_MAP[(editor as any).container.id];
          return callback(null, autocomplete(factory, prefix));
        } catch (e) {
          log.error(e);
          return callback(null, []);
        }
      },
    };

    langTools.setCompleters([completer]);
  }, [autocomplete, editorRef]);

  return (
    <div
      className={`editor-container ${
        singleLine ? 'editor-container--singleLine vertical-align-center' : ''
      }`}
    >
      {label && <label className="label input-label">{label}</label>}
      <AceEditor
        ref={setEditorRef}
        mode={language}
        theme={theme === 'dark' ? 'dracula' : 'github'}
        maxLines={singleLine ? 1 : undefined}
        wrapEnabled={true}
        onBlur={() => {
          debounced.flush(); /* Simplifying this to onBlur={debounced.flush} doesn't work. */
        }}
        name={id}
        defaultValue={String(value)}
        onChange={(v) => debounced(v)}
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
              debounced.flush();
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
            : {
                enableBasicAutocompletion: Boolean(
                  autocomplete && !autocompleteDisabled
                ),
                enableLiveAutocompletion: Boolean(
                  autocomplete && !autocompleteDisabled
                ),
              }
        }
      />
      {tooltip && <Tooltip>{tooltip}</Tooltip>}
    </div>
  );
}
