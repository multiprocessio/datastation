import * as React from 'react';

export function Button({
  className,
  children,
  onClick,
  type,
  icon,
  disabled,
}: {
  className?: string;
  children: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'primary' | 'outline';
  icon?: boolean;
  disabled?: boolean;
}) {
  let buttonClass = `button ${className ? ' ' + className : ''}`;
  if (type) {
    buttonClass += ` button--${type}`;
  }

  if (icon) {
    buttonClass += ' material-icons' + (type === 'outline' ? '-outlined' : '');
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
