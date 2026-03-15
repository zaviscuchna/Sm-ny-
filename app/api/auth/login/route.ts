import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user) return NextResponse.json(null)

  const business = await prisma.business.findUnique({
    where: { id: user.business_id },
  })

  return NextResponse.json({
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      color:      user.color,
      businessId: user.business_id,
    },
    business: business ? {
      id:       business.id,
      name:     business.name,
      location: business.location,
    } : null,
    joinCode: business?.join_code ?? null,
  })
}
