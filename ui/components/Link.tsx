import React from 'react';
import { UrlState, UrlStateContext } from '../urlState';

interface LinkProps {
  args: Partial<UrlState>;
  className?: string;
  children?: React.ReactNode;
}

export function Link({ args, className }: LinkProps) {
  const url =
    '?' +
    Object.entries(args)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
  const { setState: setUrlState } = React.useContext(UrlStateContext);
  function navigate(e: React.SyntheticEvent) {
    e.preventDefault();
    setUrlState(args);
  }

  return <a href={url} onClick={navigate} className={className} />;
}
