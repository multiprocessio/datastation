import React from 'react';
import { UrlState, UrlStateContext } from '../urlState';

interface LinkProps extends React.HTMLProps<HTMLAnchorElement> {
  args: Partial<UrlState>;
}

export function Link({ args, ...rest }: LinkProps) {
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

  return <a href={url} onClick={navigate} {...rest} />;
}
