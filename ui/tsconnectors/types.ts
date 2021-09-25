import { ServerInfo, TimeSeriesConnectorInfo } from '../../shared/state';

export interface DetailsProps {
  connector: TimeSeriesConnectorInfo;
  updateConnector: (c: TimeSeriesConnectorInfo) => void;
  servers: Array<ServerInfo>;
  skipDatabase?: boolean;
}
