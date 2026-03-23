import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    // Get all active employees
    const totalEmployees = await prisma.employee.count({
      where: { isActive: true },
    })

    // Get today's attendance records
    const todayRecords = await prisma.attendanceRecord.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    })

    const checkedIn = todayRecords.filter((r) => r.checkIn !== null).length
    const late = todayRecords.filter((r) => r.status === 'LATE').length
    const absent = todayRecords.filter((r) => r.status === 'ABSENT').length

    // Department stats
    const departments = await prisma.department.findMany({
      include: {
        employees: {
          where: { isActive: true },
        },
      },
    })

    const departmentStats = departments.map((dept) => {
      const total = dept.employees.length
      const employeeIds = dept.employees.map((e) => e.id)
      const presentRecords = todayRecords.filter(
        (r) => employeeIds.includes(r.employeeId) && r.status !== 'ABSENT'
      )
      const present = presentRecords.length
      const rate = total > 0 ? Math.round((present / total) * 100) : 0
      return {
        name: dept.name,
        total,
        present,
        rate,
      }
    })

    // Shift distribution
    const shiftCounts = await prisma.employee.groupBy({
      by: ['shiftType'],
      where: { isActive: true },
      _count: { shiftType: true },
    })

    const shiftDistribution: Record<string, number> = {
      SHIFT_8: 0,
      SHIFT_9: 0,
      SHIFT_10: 0,
    }
    for (const sc of shiftCounts) {
      shiftDistribution[sc.shiftType] = sc._count.shiftType
    }

    // Anomalies
    const anomalies = todayRecords
      .filter((r) => r.isAnomaly)
      .map((r) => ({
        id: r.id,
        employeeName: r.employee.name,
        employeeNumber: r.employee.employeeNumber,
        department: r.employee.department.name,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
      }))

    return NextResponse.json({
      summary: {
        totalEmployees,
        checkedIn,
        late,
        absent,
      },
      departmentStats,
      shiftDistribution,
      anomalies,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
