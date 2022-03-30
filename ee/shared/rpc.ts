// Copyright 2022 Multiprocess Labs LLC

import * as rpc_ce from '../../shared/rpc';
import { History } from './state';

export type Endpoint = rpc_ce.Endpoint | 'getHistory';

export type GetHistoryRequest = { lastId?: string };
export type GetHistoryResponse = { history: Array<History> };
