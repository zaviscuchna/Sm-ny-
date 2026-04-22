/**
 * Pomocníci na bezpečné zpracování API odpovědí v klientských stránkách.
 *
 * - Při 401 pošle `auth:expired` event (AuthContext na něj odhlásí).
 * - Při non-array JSON vrátí prázdné pole, ať se .filter / .map / .sort nerozbije.
 */

export async function safeFetchArray<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T[]> {
  try {
    const res = await fetch(input, init)
    if (!res.ok) return []
    const data = await res.json().catch(() => null)
    return Array.isArray(data) ? (data as T[]) : []
  } catch {
    return []
  }
}

export async function safeFetchObject<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(input, init)
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return (data && typeof data === 'object' && !Array.isArray(data)) ? (data as T) : null
  } catch {
    return null
  }
}
