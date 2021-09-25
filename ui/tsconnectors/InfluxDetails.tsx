import React from 'react';
import { TimeSeriesPanelUIDetails } from './types';

export function InfluxDetails() {
  return <span />;
}

export const influxDetails: TimeSeriesPanelUIDetails = {
  id: 'influx',
  name: 'InfluxDB',
  details: InfluxDetails,
};
