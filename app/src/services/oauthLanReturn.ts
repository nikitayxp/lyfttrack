/**
 * Supabase Auth rejects non-loopback IP redirects and falls back to Site URL.
 * Dev LAN via Tailscale/Wi-Fi IP must bounce through a hostname callback.
 * @see https://github.com/supabase/auth/pull/1984
 */

const LAN_CALLBACK_PATH = '/callback';

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

/** Only bounce back to our Metro callback on LAN / loopback — no open redirect. */
export function isAllowedLanReturn(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    if (parsed.pathname !== LAN_CALLBACK_PATH && parsed.pathname !== `${LAN_CALLBACK_PATH}/`) {
      return false;
    }

    if (parsed.username || parsed.password) {
      return false;
    }

    const host = parsed.hostname;

    if (isLoopbackHostname(host)) {
      return true;
    }

    // Tailscale CGNAT 100.x and common private LAN ranges
    if (/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
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
    'lan_return should allow Tailscale IP callback'
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
