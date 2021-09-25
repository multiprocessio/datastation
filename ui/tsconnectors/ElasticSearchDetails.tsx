import React from 'react';
import { TimeSeriesPanelUIDetails } from './types';

export function ElasticSearchDetails() {
  return <span />;
}

export const elasticsearchDetails: TimeSeriesPanelUIDetails = {
  id: 'elasticsearch',
  name: 'ElasticSearch',
  details: ElasticSearchDetails,
};
