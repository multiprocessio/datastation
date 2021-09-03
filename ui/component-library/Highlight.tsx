import * as React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import vsStyle from 'react-syntax-highlighter/dist/esm/styles/prism/vs';
import vsdpStyle from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import javascript from 'refractor/lang/javascript.js';
import json from 'refractor/lang/json.js';

window.addEventListener('load', function () {
  SyntaxHighlighter.registerLanguage('javascript', javascript);
  SyntaxHighlighter.registerLanguage('json', json);

  for (let style of [vsdpStyle, vsStyle]) {
    style['code[class*="language-"]'].fontFamily = '';
    style['code[class*="language-"]'].fontSize = '';
    style['code[class*="language-"]'].background = '';
    style['pre[class*="language-"]'].fontFamily = '';
    style['pre[class*="language-"]'].fontSize = '';
    style['pre[class*="language-"]'].background = '';
    style['pre[class*="language-"]'].overflow = '';
  }
});

export function Highlight({
  language,
  children,
  theme = 'dark',
}: {
  language: string;
  children: React.ReactNode;
  theme: 'dark' | 'light';
}) {
  const style = {
    dark: vsdpStyle,
    light: vsStyle,
  }[theme];
  return (
    <SyntaxHighlighter style={style} language={language} children={children} />
  );
}
