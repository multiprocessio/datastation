import * as React from 'react';

export function Button({
  className,
  children,
  onClick,
  type,
  icon,
  disabled,
  primary,
}: {
  className?: string;
  children: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'primary' | 'outline';
  icon?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  let buttonClass = `button ${className ? ' ' + className : ''}`;
  if (type) {
    buttonClass += ` button--${type}`;
  }

  if (icon) {
    buttonClass += ` material-icons`;
  }

  return (
    <button
      disabled={disabled}
      type="button"
      className={buttonClass}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
