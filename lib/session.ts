import { NextRequest, NextResponse } from 'next/server'

const SECRET = process.env.SESSION_SECRET
  || 'dev-fallback-change-me-7f9d3a1b2c8e5f4a6d0b9c2e1f8a7b4d'

const COOKIE_NAME = 'smenky_session'
const COOKIE_MAX_AGE_DAYS = 30

export interface SessionPayload {
  userId: string
  bizId: string
  role: 'manager' | 'employee' | 'superadmin'
  name: string
  email: string
  exp: number
}

function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlEncodeString(str: string): string {
  return b64urlEncodeBytes(new TextEncoder().encode(str))
}

function b64urlDecodeToString(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function b64urlDecodeToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

let keyPromise: Promise<CryptoKey> | null = null
function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    )
  }
  return keyPromise
}

async function signData(data: string): Promise<string> {
  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return b64urlEncodeBytes(new Uint8Array(sig))
}

async function verifyData(data: string, sig: string): Promise<boolean> {
  const key = await getKey()
  try {
    const sigBytes = b64urlDecodeToBytes(sig)
    return await crypto.subtle.verify('HMAC', key, sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer, new TextEncoder().encode(data))
  } catch { return false }
}

export async function signSession(payload: Omit<SessionPayload, 'exp'>, maxAgeDays = COOKIE_MAX_AGE_DAYS): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeDays * 24 * 60 * 60,
  }
  const body = b64urlEncodeString(JSON.stringify(full))
  const sig  = await signData(body)
  return `${body}.${sig}`
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const ok = await verifyData(body, sig)
  if (!ok) return null
  try {
    const payload = JSON.parse(b64urlDecodeToString(body)) as SessionPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  return verifySession(req.cookies.get(COOKIE_NAME)?.value)
}

export async function setSessionCookie(res: NextResponse, payload: Omit<SessionPayload, 'exp'>, rememberDays = COOKIE_MAX_AGE_DAYS) {
  const token = await signSession(payload, rememberDays)
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: rememberDays * 24 * 60 * 60,
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({ name: COOKIE_NAME, value: '', path: '/', maxAge: 0 })
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
