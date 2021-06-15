import * as React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages, Language } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';

export function CodeEditor({
  value,
  onChange,
  className,
  disabled,
  onKeyDown,
  language,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  language: string;
}) {
  const highlightWithLineNumbers = (input: string, language: Language) =>
    highlight(input, language)
      .split('\n')
      .map((line, i) => `<span class='editorLineNumber'>${i + 1}</span>${line}`)
      .join('\n');
  return (
    <div className="editor-container">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) =>
          highlightWithLineNumbers(code, languages[language])
        }
        onKeyDown={onKeyDown}
        className={className}
        disabled={disabled}
        textareaId="codeArea"
      />
    </div>
  );
}
