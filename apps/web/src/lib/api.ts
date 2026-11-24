import { supabase } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  tenantId?: string,
  locationId?: string
): Promise<T> {
  let session = (await supabase.auth.getSession()).data.session;

  // Proactively refresh session if it expires within 30 seconds
  if (session?.expires_at && session.expires_at * 1000 - Date.now() < 30000) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session) {
        session = refreshed.data.session;
      }
    } catch {}
  }

  let token = session?.access_token;

  const buildHeaders = (tok?: string) => {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (tok) {
      headers.set('Authorization', `Bearer ${tok}`);
    }

    const effectiveTenantId =
      tenantId ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('staff_tenant_id') || undefined
        : undefined);

    const effectiveLocationId =
      locationId ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('staff_location_id') || undefined
        : undefined);

    if (effectiveTenantId) {
      headers.set('x-tenant-id', effectiveTenantId);
    }
    if (effectiveLocationId) {
      headers.set('x-location-id', effectiveLocationId);
    }
    return headers;
  };

  let res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: buildHeaders(token),
  });

  // If 401 Unauthorized and we had a session, attempt refresh once and retry
  if (res.status === 401 && session) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data?.session?.access_token) {
        token = refreshed.data.session.access_token;
        res = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: buildHeaders(token),
        });
      }
    } catch {}
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export async function publicFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }

  return res.json();
}

