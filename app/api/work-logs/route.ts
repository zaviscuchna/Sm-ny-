import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function calcHours(clockIn: string, clockOut: string): number {
  const [ih, im] = clockIn.split(':').map(Number)
  const [oh, om] = clockOut.split(':').map(Number)
  return Math.round(((oh + om / 60) - (ih + im / 60)) * 10) / 10
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const bizId      = searchParams.get('bizId')
  const employeeId = searchParams.get('employeeId')
  const month      = searchParams.get('month') // "yyyy-MM"

  if (!bizId) return NextResponse.json([], { status: 400 })

  if (employeeId) {
    // Employee logs
    const rows = await prisma.workLog.findMany({
      where: { employee_id: employeeId, business_id: bizId },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(rows.map(rowToLog))
  }

  if (month) {
    // Business monthly logs
    const [y, m] = month.split('-').map(Number)
    const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const rows = await prisma.workLog.findMany({
      where: {
        business_id: bizId,
        date: { gte: `${month}-01`, lt: `${nextM}-01` },
      },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(rows.map(rowToLog))
  }

  return NextResponse.json([])
}

export async function POST(req: NextRequest) {
  const { log, bizId } = await req.json()
  const id    = `wl-${Date.now()}`
  const hours = calcHours(log.clockIn, log.clockOut)

  await prisma.workLog.create({
    data: {
      id,
      employee_id:   log.employeeId,
      employee_name: log.employeeName,
      business_id:   bizId,
      date:          log.date,
      clock_in:      log.clockIn,
      clock_out:     log.clockOut,
      hours,
      notes:         log.notes ?? null,
    },
  })

  return NextResponse.json({ id, hours, ...log })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })
  await prisma.workLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

function rowToLog(row: any) {
  return {
    id:           row.id,
    employeeId:   row.employee_id,
    employeeName: row.employee_name,
    date:         row.date,
    clockIn:      row.clock_in,
    clockOut:     row.clock_out,
    hours:        parseFloat(row.hours),
    notes:        row.notes ?? undefined,
  }
}
