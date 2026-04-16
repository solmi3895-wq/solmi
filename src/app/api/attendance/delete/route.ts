import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자만 삭제할 수 있습니다.' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const mode = searchParams.get('mode') // 'all', 'month', or null (single date)
    const date = searchParams.get('date')

    if (mode === 'all') {
      // 모든 기록 삭제
      const deleted = await prisma.attendanceRecord.deleteMany()
      return NextResponse.json({ success: true, deleted: deleted.count, mode: 'all' })
    }

    if (mode === 'month') {
      // 해당 월 삭제
      const year = parseInt(searchParams.get('year') || '')
      const month = parseInt(searchParams.get('month') || '')
      if (!year || !month) {
        return NextResponse.json({ error: '년/월을 지정해주세요.' }, { status: 400 })
      }
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1, -9))
      const endOfMonth = new Date(Date.UTC(year, month, 0, 14, 59, 59, 999))
      const deleted = await prisma.attendanceRecord.deleteMany({
        where: {
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      })
      return NextResponse.json({ success: true, deleted: deleted.count, mode: 'month', year, month })
    }

    // 단일 날짜 삭제
    if (!date) {
      return NextResponse.json({ error: '날짜를 지정해주세요.' }, { status: 400 })
    }

    const t = new Date(date)
    const targetDate = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), -9))
    const nextDate = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 14, 59, 59, 999))

    const deleted = await prisma.attendanceRecord.deleteMany({
      where: {
        date: { gte: targetDate, lt: nextDate },
      },
    })

    return NextResponse.json({ success: true, deleted: deleted.count, date })
  } catch (error) {
    console.error('Delete attendance error:', error)
    return NextResponse.json({ error: '삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
