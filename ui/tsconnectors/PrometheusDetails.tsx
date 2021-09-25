import React from 'react';
import { TimeSeriesPanelUIDetails } from './types';

export function PrometheusDetails() {
  return <span />;
}

export const prometheusDetails: TimeSeriesPanelUIDetails = {
  id: 'prometheus',
  name: 'Prometheus',
  details: PrometheusDetails,
};
