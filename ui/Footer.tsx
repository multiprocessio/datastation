import * as React from 'react';
import { APP_NAME, VERSION } from '../shared/constants';

export function Footer() {
  return (
    <footer>
      <p className="text-center text-muted">
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSfYF3AZivacRrQWanC-skd0iI23ermwPd17T_64Xc4etoL_Tw/viewform"
          target="_blank"
        >
          Join the mailing list
        </a>{' '}
        to stay up-to-date on releases, new tutorials, and everything else!
      </p>
      <div>
        {APP_NAME} {VERSION}
      </div>
    </footer>
  );
}
