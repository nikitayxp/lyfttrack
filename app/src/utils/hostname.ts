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
