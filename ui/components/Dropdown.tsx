import React from 'react';

export function Dropdown({
  groups,
  title,
  trigger,
  className,
}: {
  groups: {
    name: string;
    id: string;
    items: { render: (close: () => void) => React.ReactElement; id: string }[];
  }[];
  title?: string;
  trigger: (open: () => void) => React.ReactElement;
  className?: string;
}) {
  const [open, toggleDropdown] = React.useState(false);

  return (
    <div
      className={`dropdown ${open ? 'dropdown--open' : ''} ${className || ''}`}
      tabIndex={-1}
      onBlur={(e) => {
        // Ignore onBlur for child elements
        if (!e.currentTarget.contains(e.relatedTarget)) {
          toggleDropdown(false);
        }
      }}
    >
      <div className="dropdown-anchor">
        {trigger(() => toggleDropdown(() => true))}
      </div>
      <div className="dropdown-body">
        {title && <div className="dropdown-title"></div>}
        {groups.map((group) => (
          <div key={group.id} className="dropdown-section">
            {group.name && (
              <div className="dropdown-sectionName">{group.name}</div>
            )}
            {group.items.map((item) => (
              <div key={item.id} className="dropdown-items">
                <div className="dropdown-item">
                  {item.render(() => toggleDropdown(false))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
