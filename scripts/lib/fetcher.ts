/**
 * Rate-limited HTTP client for Colombian legislation ingestion.
 *
 * Primary source:
 *   https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i={ID}
 *
 * Notes:
 * - 1200ms minimum delay between requests (government server friendly)
 * - Retry on transient errors (429/5xx)
 * - Optional TLS bypass ONLY for environments missing CA roots
 *   (set ALLOW_INSECURE_TLS=1 explicitly)
 */

const USER_AGENT = 'Ansvar-Law-MCP/1.0 (+https://github.com/Ansvar-Systems/Colombian-law-mcp)';
const MIN_DELAY_MS = 1200;
const MAX_RETRIES = 3;
const BASE_URL = 'https://www.funcionpublica.gov.co/eva/gestornormativo';

let lastRequestTime = 0;
let insecureTlsNoticeShown = false;

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

interface FetchOptions {
  accept?: string;
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function maybeEnableInsecureTls(): void {
  if (process.env.ALLOW_INSECURE_TLS !== '1') return;
  if (!insecureTlsNoticeShown) {
    console.warn('WARNING: ALLOW_INSECURE_TLS=1 enabled for ingestion session.');
    insecureTlsNoticeShown = true;
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export function buildNormaUrl(portalId: number): string {
  return `${BASE_URL}/norma.php?i=${portalId}`;
}

export async function fetchWithRateLimit(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const accept = options.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

  maybeEnableInsecureTls();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await rateLimit();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': accept,
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      const body = await response.text();
      const status = response.status;

      if ((status === 429 || status >= 500) && attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.warn(`Transient HTTP ${status} for ${url}, retrying in ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }

      return {
        status,
        body,
        contentType: response.headers.get('content-type') ?? '',
        url: response.url,
      };
    } catch (error) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.warn(`Network error for ${url}, retrying in ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }

      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch ${url}: ${msg}`);
    }
  }

  throw new Error(`Failed to fetch ${url}: retries exhausted`);
}

export async function fetchNormaHtml(portalId: number): Promise<FetchResult> {
  return fetchWithRateLimit(buildNormaUrl(portalId), { accept: 'text/html, */*' });
}
