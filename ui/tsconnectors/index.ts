import { TimeSeriesConnectorInfoType } from '../../shared/state';
import { DetailsProps } from './types';
import { ElasticSearchDetails } from './ElasticSearchDetails';
import { SplunkDetails } from './SplunkDetails';
import { PrometheusDetails } from './PrometheusDetails';
import { InfluxDetails } from './InfluxDetails';

export const VENDORS: Array<{
  group: string;
  vendors: Array<{
    name: string;
    id: TimeSeriesConnectorInfoType;
    details: React.Component<DetailsProps>;
  }>;
}> = [
  {
    group: 'Log Databases',
    vendors: [
      {
        name: 'ElasticSearch',
        id: 'elasticsearch',
        details: ElasticSearchDetails,
      },
      {
        name: 'Splunk',
        id: 'splunk',
        details: SplunkDetails,
      },
    ],
  },
  {
    group: 'Metrics Databases',
    vendors: [
      {
        name: 'Prometheus',
        id: 'prometheus',
        details: PrometheusDetails,
      },
      {
        name: 'InfluxDB',
        id: 'influx',
        details: InfluxDetails,
      },
    ],
  },
];
