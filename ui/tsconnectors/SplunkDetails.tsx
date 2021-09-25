import React from 'react';
import { TimeSeriesPanelUIDetails } from './types';

export function SplunkDetails() {
  return <span />;
}

export const splunkDetails: TimeSeriesPanelUIDetails = {
  id: 'splunk',
  name: 'Splunk',
  details: SplunkDetails,
};
