import * as rpc_ce from '../../desktop/rpc';
import { Endpoint } from '../shared/rpc';

export type RPCPayload = rpc_ce.GenericRPCPayload<Endpoint>;
export type Dispatch = rpc_ce.GenericDispatch<Endpoint>;
