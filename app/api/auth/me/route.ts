import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const s = await getSession(req)
  if (!s) return NextResponse.json({ user: null }, { status: 200 })
  return NextResponse.json({
    user: {
      id: s.userId,
      name: s.name,
      email: s.email,
      role: s.role,
      businessId: s.bizId,
    },
  })
}
