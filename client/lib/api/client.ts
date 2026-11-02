// HTTP on 4201, HTTPS on 4202 (when NETWORK=true)
function getApiPort(): number {
  if (typeof window === 'undefined') return 4201;
  return window.location.protocol === 'https:' ? 4202 : 4201;
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:4201/api';
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:${getApiPort()}/api`;
}

function getWsUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:4201/api';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:${getApiPort()}/api`;
}

export { getWsUrl };

interface ApiResponse<T> {
  data: T;
}

interface ApiError {
  error: string;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  const body = (await res.json()) as ApiResponse<T>;
  return body.data;
}
