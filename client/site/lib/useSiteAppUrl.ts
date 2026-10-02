import { useEffect, useState } from 'react';
import { runtimeEnvOr } from '../../src/config/runtimeConfig';

const publishedAppUrl =
  import.meta.env.VITE_APP_URL ||
  (import.meta.env.PROD ? 'https://app.baitly.fr' : 'http://localhost:3000');

/** Match the published link first, then apply this deployment's runtime domain. */
export function useSiteAppUrl() {
  const [url, setUrl] = useState(publishedAppUrl);
  useEffect(() => setUrl(runtimeEnvOr('VITE_APP_URL', publishedAppUrl)), []);
  return url.replace(/\/+$/, '');
}
