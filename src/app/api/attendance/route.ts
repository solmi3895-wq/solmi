import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateStr = searchParams.get('date')
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')

    const targetDate = dateStr ? new Date(dateStr) : new Date()
    // KST 기준 날짜를 UTC로 변환하여 조회
    const startOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), -9))
    const endOfDay = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 14, 59, 59, 999))

    const where: Record<string, unknown> = {
      date: { gte: startOfDay, lte: endOfDay },
    }
    const search = searchParams.get('search')
    if (status) where.status = status
    if (departmentId || search) {
      const empWhere: Record<string, unknown> = {}
      if (departmentId) empWhere.departmentId = departmentId
      if (search) empWhere.name = { contains: search }
      where.employee = empWhere
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: { employee: { include: { department: true } } },
      orderBy: { employee: { name: 'asc' } },
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error('Attendance API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
