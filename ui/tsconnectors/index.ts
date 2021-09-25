import { TimeSeriesConnectorInfoType } from '../../shared/state';
import { ElasticSearchDetails } from './ElasticSearchDetails';
import { InfluxDetails } from './InfluxDetails';
import { PrometheusDetails } from './PrometheusDetails';
import { SplunkDetails } from './SplunkDetails';
import { DetailsProps } from './types';

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
