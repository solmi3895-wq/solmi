import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const name = searchParams.get('name')
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    // KST 기준 월 범위 (UTC 보정)
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, -9))
    const endOfMonth = new Date(Date.UTC(year, month, 0, 14, 59, 59, 999))

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employee: { name: { contains: name } },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { employee: { include: { department: true } } },
      orderBy: { date: 'asc' },
    })

    const normal = records.filter((r) => r.status === 'NORMAL').length
    const late = records.filter((r) => r.status === 'LATE').length
    const absent = records.filter((r) => r.status === 'ABSENT').length
    const annualLeave = records.filter((r) => r.status === 'ANNUAL_LEAVE').length
    const halfDay = records.filter((r) => r.status === 'AM_HALF' || r.status === 'PM_HALF').length
    const earlyLeave = records.filter((r) => r.status === 'EARLY_LEAVE').length

    const days = records.map((r) => ({
      date: r.date,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
      workHours: r.workHours,
    }))

    const employee = records.length > 0 ? {
      name: records[0].employee.name,
      department: records[0].employee.department.name,
      shiftType: records[0].employee.shiftType,
    } : null

    return NextResponse.json({ employee, summary: { normal, late, absent, annualLeave, halfDay, earlyLeave, total: records.length }, days })
  } catch (error) {
    console.error('Monthly API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
