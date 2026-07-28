/**
 * Supabase Auth rejects non-loopback IP redirects and falls back to Site URL.
 * Dev LAN via Tailscale/Wi-Fi IP must bounce through a hostname callback.
 * @see https://github.com/supabase/auth/pull/1984
 */

const LAN_CALLBACK_PATH = '/callback';
const METRO_PORT = '8081';

export function isIpHostname(hostname: string): boolean {
  if (!hostname) {
    return false;
  }

  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return true;
  }

  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/** Tailscale CGNAT is 100.64.0.0/10 — not the whole 100.0.0.0/8. */
function isTailscaleCgnatHost(host: string): boolean {
  const match = /^100\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);

  if (!match) {
    return false;
  }

  const octets = match.slice(1).map(Number);

  if (octets.some((n) => n > 255)) {
    return false;
  }

  return octets[0] >= 64 && octets[0] <= 127;
}

function isPrivateLanHost(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);

  if (!match) {
    return false;
  }

  const [a, b, c, d] = match.slice(1).map(Number);

  if ([a, b, c, d].some((n) => n > 255)) {
    return false;
  }

  // RFC1918
  if (a === 10) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  return false;
}

/** Only bounce back to our Metro callback on LAN / loopback — no open redirect. */
export function isAllowedLanReturn(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Metro is always http on :8081 in this workflow.
    if (parsed.protocol !== 'http:') {
      return false;
    }

    if (parsed.pathname !== LAN_CALLBACK_PATH && parsed.pathname !== `${LAN_CALLBACK_PATH}/`) {
      return false;
    }

    if (parsed.username || parsed.password) {
      return false;
    }

    if (parsed.port !== METRO_PORT) {
      return false;
    }

    const host = parsed.hostname;

    if (isLoopbackHostname(host)) {
      return true;
    }

    if (isTailscaleCgnatHost(host) || isPrivateLanHost(host)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function buildLanOAuthBounceRedirectTo(
  productionCallbackBase: string,
  lanCallbackUrl: string
): string {
  const base = productionCallbackBase.replace(/\/+$/, '');
  return `${base}${LAN_CALLBACK_PATH}?lan_return=${encodeURIComponent(lanCallbackUrl)}`;
}

// ponytail: assert-based self-check (no test framework)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.assert(
    isAllowedLanReturn('http://100.82.142.7:8081/callback'),
    'lan_return should allow Tailscale CGNAT callback'
  );
  console.assert(
    !isAllowedLanReturn('http://100.50.0.1:8081/callback'),
    'lan_return must reject public 100.x outside CGNAT'
  );
  console.assert(
    !isAllowedLanReturn('https://evil.example/callback'),
    'lan_return must reject foreign hosts'
  );
  console.assert(
    isIpHostname('100.82.142.7') && !isIpHostname('localhost'),
    'isIpHostname distinguishes IP vs name'
  );
}
