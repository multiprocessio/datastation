import * as React from 'react';

export interface ButtonProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: 'primary' | 'outline';
  icon?: boolean;
}

export function Button({ className, type, icon, ...props }: ButtonProps) {
  let buttonClass = `button ${className ? ' ' + className : ''}`;
  if (type) {
    buttonClass += ` button--${type}`;
  }

  if (icon) {
    buttonClass += ' material-icons' + (type === 'outline' ? '-outlined' : '');
  }

  return <button type="button" className={buttonClass} {...props} />;
}
