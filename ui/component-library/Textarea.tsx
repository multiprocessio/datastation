import * as React from 'react';

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
  let textareaClass = 'textarea';
  if (className) {
    textareaClass += ` ${className}`;
  }

  return (
    <textarea
      value={value}
      onKeyDown={onKeyDown}
      spellCheck={spellCheck}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(e.target.value)
      }
      className={textareaClass}
      disabled={disabled}
    />
  );
}
