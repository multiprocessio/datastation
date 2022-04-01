import { IconHelp } from '@tabler/icons';
import React from 'react';

export function Tooltip({ children }: { children: React.ReactNode }) {
  const ref = React.useRef(null);
  const [positioned, setPositioned] = React.useState(false);
  React.useEffect(() => {
    if (ref.current && !positioned) {
      const b = ref.current.querySelector('.tooltip-body');
      b.style.top += ref.current.offsetTop + ref.current.offsetHeight;
      b.style.left += ref.current.offsetLeft;
      setPositioned(true);
    }
  }, [positioned]);

  return (
    <span
      ref={(r) => {
        ref.current = r;
      }}
      className="tooltip"
    >
      <span className="tooltip-icon">
        <IconHelp />
      </span>
      <span className="tooltip-body">{children}</span>
    </span>
  );
}
