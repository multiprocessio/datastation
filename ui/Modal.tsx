import React from 'react';
import * as ReactDOM from 'react-dom';

export function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="modal">
      <div className="modal-body">{children}</div>
    </div>
  );
}

Modal.launch = function (
  cb: ({ onClose }: { onClose: () => void }) => React.ReactNode
) {
  const m = document.getElementById('modal');
  function onClose() {
    ReactDOM.unmountComponentAtNode(m);
  }
  ReactDOM.render(<Modal>{cb({ onClose })}</Modal>, m);
};
