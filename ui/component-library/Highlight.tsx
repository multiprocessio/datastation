import * as React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import style from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import javascript from 'refractor/lang/javascript.js';
import json from 'refractor/lang/json.js';

window.addEventListener('load', function () {
  SyntaxHighlighter.registerLanguage('javascript', javascript);
  SyntaxHighlighter.registerLanguage('json', json);

  style['code[class*="language-"]'].fontFamily = '';
  style['code[class*="language-"]'].fontSize = '';
  style['code[class*="language-"]'].background = '';
  style['pre[class*="language-"]'].fontFamily = '';
  style['pre[class*="language-"]'].fontSize = '';
  style['pre[class*="language-"]'].background = '';
  style['pre[class*="language-"]'].overflow = '';
});

export function Highlight({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) {
  return (
    <SyntaxHighlighter style={style} language={language} children={children} />
  );
}
