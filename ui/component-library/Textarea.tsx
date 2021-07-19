import * as React from 'react';

import { useDebouncedLocalState } from './Input';

export function Textarea({
  spellCheck = false,
  value,
  onChange,
  className,
  disabled,
  onKeyDown,
}: {
  spellCheck?: boolean;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const [localValue, setLocalValue] = useDebouncedLocalState(value, onChange);
  let textareaClass = 'textarea';
  if (className) {
    textareaClass += ` ${className}`;
  }

  return (
    <textarea
      value={localValue}
      onKeyDown={onKeyDown}
      spellCheck={spellCheck}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
        setLocalValue(e.target.value)
      }
      className={textareaClass}
      disabled={disabled}
    />
  );
}
