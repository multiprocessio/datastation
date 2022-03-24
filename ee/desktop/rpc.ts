import * as rpc_ce from '../../desktop/rpc';
import { Endpoint, GetHistoryRequest, GetHistoryResponse } from '../shared/rpc';

export type RPCPayload = rpc_ce.GenericRPCPayload<Endpoint>;
export type Dispatch = rpc_ce.GenericDispatch<Endpoint>;

export type RPCHandler = rpc_ce.RPCHandler<any, any, Endpoint>;

export type GetHistoryHandler = rpc_ce.RPCHandler<
  GetHistoryRequest,
  GetHistoryResponse,
  Endpoint
>;
