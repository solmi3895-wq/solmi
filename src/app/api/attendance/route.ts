import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const dateStr = searchParams.get('date')
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')

    const targetDate = dateStr ? new Date(dateStr) : new Date()
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)

    const where: Record<string, unknown> = {
      date: { gte: startOfDay, lte: endOfDay },
    }
    if (status) where.status = status
    if (departmentId) where.employee = { departmentId }

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
