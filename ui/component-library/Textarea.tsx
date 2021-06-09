import * as React from 'react';

export function Textarea({
  spellCheck,
  value,
  onChange,
  className,
  disabled,
}: {
  spellCheck?: 'true' | 'false';
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  let textareaClass = 'textarea';
  if (className) {
    textareaClass += ` ${className}`;
  }

  return (
    <textarea
      value={value}
      spellCheck={spellCheck}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(e.target.value)
      }
      className={textareaClass}
      disabled={disabled}
    />
  );
}
