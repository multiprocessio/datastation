import { TimeSeriesConnectorInfoType } from '../../shared/state';
import { elasticsearchDetails } from './ElasticSearchDetails';
import { influxDetails } from './InfluxDetails';
import { prometheusDetails } from './PrometheusDetails';
import { splunkDetails } from './SplunkDetails';
import { TimeSeriesPanelUIDetails } from './types';

export const VENDORS: {
  [Property in TimeSeriesConnectorInfoType]: TimeSeriesPanelUIDetails;
} = {
  elasticsearch: elasticsearchDetails,
  splunk: splunkDetails,
  prometheus: prometheusDetails,
  influx: influxDetails,
};

export const VENDOR_GROUPS: Array<{
  label: string;
  vendors: Array<TimeSeriesConnectorInfoType>;
}> = [
  {
    label: 'Log Databases',
    vendors: ['elasticsearch', 'splunk'],
  },
  {
    label: 'Metrics Databases',
    vendors: ['prometheus', 'influx'],
  },
];
