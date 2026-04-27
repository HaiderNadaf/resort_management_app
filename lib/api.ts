const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

if (!BASE_URL) {
  throw new Error('Missing EXPO_PUBLIC_BASE_URL in frontend .env');
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  isFormData?: boolean;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, isFormData = false } = options;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      json?.message ||
      (Array.isArray(json?.errors) && json.errors.length > 0
        ? String(json.errors[0]?.msg || json.errors[0]?.message || 'Request failed')
        : 'Request failed');
    throw new Error(message);
  }

  return json as T;
}

export { BASE_URL };
