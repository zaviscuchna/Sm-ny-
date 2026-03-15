import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const AVATAR_COLORS = ['#6366f1','#f59e0b','#10b981','#ec4899','#3b82f6','#8b5cf6','#14b8a6','#f97316']
const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]

export async function POST(req: NextRequest) {
  const { type, name, email, businessName, location, joinCode } = await req.json()

  // Check if email already exists in DB
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: 'Tento e-mail je již registrován.' }, { status: 400 })
  }

  let business: { id: string; name: string; location: string } | null = null
  let code: string | null = null

  if (type === 'manager') {
    const id  = `biz-reg-${Date.now()}`
    code      = String(Math.floor(100000 + Math.random() * 900000))
    const biz = await prisma.business.create({
      data: { id, name: businessName!, location: location ?? '', join_code: code },
    })
    business = { id: biz.id, name: biz.name, location: biz.location }

  } else {
    // Employee joining by code
    const biz = await prisma.business.findUnique({ where: { join_code: joinCode?.trim() } })
    if (!biz) {
      return NextResponse.json({ error: 'Kód podniku nebyl nalezen.' }, { status: 400 })
    }
    business = { id: biz.id, name: biz.name, location: biz.location }
    code = biz.join_code
  }

  const userId = `u-reg-${Date.now()}`
  const color  = randomColor()

  await prisma.user.create({
    data: {
      id:          userId,
      name,
      email:       email.toLowerCase(),
      role:        type === 'manager' ? 'manager' : 'employee',
      color,
      business_id: business.id,
    },
  })

  return NextResponse.json({
    user: { id: userId, name, email: email.toLowerCase(), role: type === 'manager' ? 'manager' : 'employee', color, businessId: business.id },
    business,
    joinCode: code,
  })
}
