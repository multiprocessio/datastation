import log from '../../shared/log';
import { Shape } from 'shape';
import { useDebouncedCallback } from 'use-debounce';
import * as React from 'react';
import { SettingsContext } from '../Settings';
import { Tooltip } from './Tooltip';
import { INPUT_SYNC_PERIOD } from './Input';
import { allFields } from './FieldPicker';

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

function skipWhitespaceBackward(it: any /* TODO: type */) {
  while (!it.getCurrentToken().value.trim()) {
    if (!it.stepBackward()) {
      return;
    }
  }
}

function skipWhitespaceForward(it: any /* TODO: type */) {
  while (!it.getCurrentToken().value.trim()) {
    if (!it.stepForward()) {
      return;
    }
  }
}

export function CodeEditor({
  value,
  panels,
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
  panels?: Array<{ id: string; name: string; shape?: Shape }>;
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

  const autocomplete = Boolean(panels && panels.length);
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
        _prefix: string,
        callback: Ace.CompleterCallback
      ) => {
        // This gets registered globally which is kind of weird.  //
        // So it needs to check again that the currently editing editor
        // is the one attached to this callback.
        if (!autocomplete || (editorRef.editor as unknown) !== editor) {
          return callback(null, []);
        }

        try {
          const completions: Ace.Completion[] = [];

          const tokenIterator = new TokenIterator(session, pos.row, pos.column);
          const token = tokenIterator.getCurrentToken();

          if (token.type === 'identifier') {
            completions.push(...[
              {
                value: 'DM_getPanel("indexOrName")',
                meta: 'Builtin',
              },
              {
                value: 'DM_setPanel(result)',
                meta: 'Builtin',
              },
            ].filter(c => c.value.startsWith(token.value)));
          }

          tokenIterator.stepBackward();
          const lParenOrDot = tokenIterator.getCurrentToken();
          tokenIterator.stepBackward();
          const functionOrIdent = tokenIterator.getCurrentToken();
          if (functionOrIdent.value === 'DM_getPanel' && lParenOrDot.value === '(' && token.type === 'string') {
            completions.push(
              ...panels.map(
                (panel) =>
                ({
                  value: panel.name,
                  meta: 'Panel',
                } as Ace.Completion)
              )
            );
          }

          if (language === 'sql') {
          } else {
            console.log(1, functionOrIdent, lParenOrDot, token);
            if (functionOrIdent.type === 'identifier' && lParenOrDot.value === '.') {
              // Make sure this was an identifier that was declared here
              // before trying to autocomplete it.

              let lastToken = functionOrIdent;
              let panelShape: Shape = null;
              console.log(2);
              outer:
              while (tokenIterator.stepBackward()) {
                // Skip whitespace
                skipWhitespaceBackward(tokenIterator);
                console.log(3);
                const token = tokenIterator.getCurrentToken();

                console.log(3.5, token, lastToken);
                // Look for an assignment/declaration
                if (lastToken.value.includes('=') && token.value === functionOrIdent.value) {
                  console.log(4, tokenIterator.getCurrentToken(), { toMatch: functionOrIdent.value });
                  console.log(tokenIterator, 'before');
                  skipWhitespaceForward(tokenIterator);
                  console.log(tokenIterator, 'after');
                  console.log(4.5, tokenIterator.getCurrentToken());
                  if (tokenIterator.getCurrentToken().value !== 'DM_getPanel') {
                    tokenIterator.stepBackward(); // Avoid infinite loop
                    lastToken = token;
                    continue;
                  }

                  console.log(5);
                  skipWhitespaceForward(tokenIterator);
                  if (tokenIterator.getCurrentToken().value !== '(') {
                    tokenIterator.stepBackward(); // Avoid infinite loop
                    lastToken = token;
                    continue;
                  }

                  console.log(6);
                  tokenIterator.stepForward();
                  const idOrName = tokenIterator.getCurrentToken().value;
                  if (idOrName.startsWith('"') || idOrName.startsWith("'")) {
                    // Chop off quotes
                    // TODO: unquote within
                    const name = idOrName.slice(1, idOrName.length - 1);
                    panelShape = panels.find(p => p.name === name).shape;
                    console.log(7);
                    break;
                  }

                  console.log(8);
                  panelShape = panels[+idOrName].shape;
                  break;
                }

                lastToken = token;
              }

              console.log(9);
              if (panelShape) {
                console.log(10);
                completions.push(...allFields(panelShape).map(([path, shape]) => ({
                  name: shape,
                  value: path,
                  meta: 'Field',
                })));
              }
            }
          }

          return callback(null, completions);
        } catch (e) {
          log.error(e);
          return callback(null, []);
        }
      },
    };

    langTools.setCompleters([completer]);
  }, [panels, autocomplete, editorRef]);

  return (
    <div
      className={`editor-container ${singleLine ? 'editor-container--singleLine vertical-align-center' : ''
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
              enableBasicAutocompletion: autocomplete,
              enableLiveAutocompletion: autocomplete,
              enableSnippets: autocomplete,
            }
        }
      />
      {tooltip && <Tooltip>{tooltip}</Tooltip>}
    </div>
  );
}
