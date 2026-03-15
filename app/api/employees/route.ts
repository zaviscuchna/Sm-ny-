import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId')
  if (!bizId) return NextResponse.json([], { status: 400 })

  const rows = await prisma.user.findMany({
    where: { business_id: bizId },
    orderBy: { name: 'asc' },
  })

  const employees = rows.map(r => ({
    id:    r.id,
    name:  r.name,
    email: r.email,
    role:  r.role,
    color: r.color,
    phone: r.phone ?? undefined,
  }))

  return NextResponse.json(employees)
}
