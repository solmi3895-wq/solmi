import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

    // KST 기준 월 범위 (UTC-9시간 보정)
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, -9))
    const endOfMonth = new Date(Date.UTC(year, month, 0, 14, 59, 59, 999))

    const records = await prisma.attendanceRecord.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      select: { date: true, status: true },
    })

    // Group by date (KST 기준)
    const dailyMap = new Map<string, { normal: number; late: number; absent: number }>()
    for (const r of records) {
      // UTC → KST (+9시간) 후 날짜 추출
      const kst = new Date(r.date.getTime() + 9 * 60 * 60 * 1000)
      const key = kst.toISOString().split('T')[0]
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
