import React from 'react';
import { SITE_ROOT } from '../shared/constants';
import { Button } from './components/Button';
import { Modal } from './Modal';

function LimitPopup({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <p>
        You've reached the limit of the free tier.{' '}
        <a href={SITE_ROOT + '/pricing.html'} target="_blank">
          Upgrade to the paid tier
        </a>{' '}
        to remove limits.
      </p>
      <Button onClick={onClose}>Or go back</Button>
    </div>
  );
}

export function limitPopup() {
  Modal.launch(({ onClose }: { onClose: () => void }) => (
    <LimitPopup onClose={onClose} />
  ));
}
