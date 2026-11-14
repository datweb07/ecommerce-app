import 'server-only';
import { serverEnv } from '../../config/server-env';
import { getServerToken } from '../server-auth';
import { createApi } from './domains';
import { createTransport } from './transport';

export const apiFetch = createTransport({
  origin: serverEnv.API_INTERNAL_URL,
  getToken: getServerToken,
});
export const serverApi = createApi(apiFetch);
