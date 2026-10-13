/** Small fetch wrapper for admin API calls: JSON in/out, throws Error(message) on failure. */
export async function api<T = unknown>(url: string, opts: { method?: string; json?: unknown; body?: BodyInit; headers?: HeadersInit } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.json !== undefined || opts.body ? "POST" : "GET"),
    headers: { ...(opts.json !== undefined ? { "content-type": "application/json" } : {}), ...opts.headers },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: { path: string; message: string }[] };
  if (!res.ok) {
    if (res.status === 401) {
      // Full reload so the proxy re-checks the session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/admin/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
    }
    const detail = data.issues?.length ? `: ${data.issues.map((i) => `${i.path} ${i.message}`).join(", ")}` : "";
    throw Object.assign(new Error((data.error ?? `Request failed (${res.status})`) + detail), { status: res.status, data });
  }
  return data as T;
}
