import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: { gte: new Date(startDate), lte: new Date(endDate) },
      },
      include: { employee: { include: { department: true } } },
      orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }],
    })

    const csvRows = [
      ['날짜', '사번', '이름', '부서', '출근시간', '퇴근시간', '근무시간', '초과근무', '상태', '이상여부'].join(','),
    ]

    for (const r of records) {
      csvRows.push([
        r.date.toISOString().split('T')[0],
        r.employee.employeeNumber,
        r.employee.name,
        r.employee.department.name,
        r.checkIn ? r.checkIn.toISOString().substring(11, 16) : '',
        r.checkOut ? r.checkOut.toISOString().substring(11, 16) : '',
        r.workHours?.toFixed(1) ?? '',
        r.overtime?.toFixed(1) ?? '',
        r.status,
        r.isAnomaly ? 'Y' : 'N',
      ].join(','))
    }

    const csv = '\uFEFF' + csvRows.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance-${startDate}-${endDate}.csv"`,
      },
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
