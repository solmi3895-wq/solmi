import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

    const records = await prisma.attendanceRecord.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      select: { date: true, status: true },
    })

    // Group by date
    const dailyMap = new Map<string, { normal: number; late: number; absent: number }>()
    for (const r of records) {
      const key = r.date.toISOString().split('T')[0]
      if (!dailyMap.has(key)) dailyMap.set(key, { normal: 0, late: 0, absent: 0 })
      const day = dailyMap.get(key)!
      if (r.status === 'NORMAL') day.normal++
      else if (r.status === 'LATE') day.late++
      else if (r.status === 'ABSENT') day.absent++
    }

    const days = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date, ...stats, total: stats.normal + stats.late + stats.absent,
    }))

    return NextResponse.json({ year, month, days })
  } catch (error) {
    console.error('Calendar API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
