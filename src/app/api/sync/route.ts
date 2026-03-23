import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { determineCheckInOut, calculateWorkHours, determineStatus, calculateOvertime } from '@/lib/attendance'

const GRACE_PERIOD_MINUTES = 10

export async function POST() {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      include: {
        accessLogs: {
          where: { accessTime: { gte: startOfDay, lte: endOfDay } },
          orderBy: { accessTime: 'asc' },
        },
      },
    })

    let synced = 0
    for (const emp of employees) {
      const { checkIn, checkOut, isAnomaly } = determineCheckInOut(emp.accessLogs)
      const workHours = checkIn ? calculateWorkHours(checkIn, checkOut) : null
      const status = determineStatus(checkIn, emp.shiftType, GRACE_PERIOD_MINUTES)
      const overtime = calculateOvertime(workHours)

      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: startOfDay } },
        create: {
          employeeId: emp.id, date: startOfDay, checkIn, checkOut,
          shiftType: emp.shiftType, workHours, overtime, status, isAnomaly,
        },
        update: { checkIn, checkOut, workHours, overtime, status, isAnomaly },
      })
      synced++
    }

    return NextResponse.json({ synced, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Sync API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
