/**
 * Obálka nad fetchem, která při 401 odhlásí uživatele globálně
 * (dispatchne custom event, na který poslouchá AuthContext).
 * Používej stejně jako fetch — návratovka je Response.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== 'undefined') {
    // Jen pokud tohle není login/register/me (nechceme zacyklit)
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url)
    if (!url.includes('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('auth:expired'))
    }
  }
  return res
}
