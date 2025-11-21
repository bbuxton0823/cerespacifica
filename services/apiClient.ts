const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, '');

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || ''
) || '';

type RequestInitExtras = RequestInit & {
  skipAuth?: boolean;
};

const getDefaultHeaders = () => ({
  'Content-Type': 'application/json'
});

const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hqs_token');
};

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

async function request<T>(
  path: string,
  { headers, body, skipAuth, ...options }: RequestInitExtras = {}
): Promise<T> {
  const token = skipAuth ? null : getAuthToken();
  const finalHeaders: HeadersInit = {
    ...getDefaultHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {})
  };

  const response = await fetch(buildUrl(path), {
    credentials: 'include',
    ...options,
    headers: finalHeaders,
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || `Request failed with status ${response.status}`
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error('Failed to parse response JSON');
  }
}

export const apiClient = {
  get<T>(path: string, options?: RequestInitExtras) {
    return request<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, data?: unknown, options?: RequestInitExtras) {
    return request<T>(path, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined
    });
  },
  put<T>(path: string, data?: unknown, options?: RequestInitExtras) {
    return request<T>(path, {
      ...options,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined
    });
  },
  delete<T>(path: string, options?: RequestInitExtras) {
    return request<T>(path, { ...options, method: 'DELETE' });
  }
};
