import {
  ServerInfo,
  TimeSeriesConnectorInfo,
  TimeSeriesConnectorInfoType,
} from '../../shared/state';

export interface DetailsProps {
  connector: TimeSeriesConnectorInfo;
  updateConnector: (c: TimeSeriesConnectorInfo) => void;
  servers: Array<ServerInfo>;
  skipDatabase?: boolean;
}

export interface TimeSeriesPanelUIDetails {
  id: TimeSeriesConnectorInfoType;
  name: string;
  details: React.ElementType<DetailsProps>;
}
