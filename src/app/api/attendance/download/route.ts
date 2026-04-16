import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth-api'
import { utils, write } from 'xlsx'

const STATUS_LABEL: Record<string, string> = {
  NORMAL: '정상',
  LATE: '지각',
  ABSENT: '결근',
  ANNUAL_LEAVE: '연차',
  AM_HALF: '오전반차',
  PM_HALF: '오후반차',
  EARLY_LEAVE: '조퇴',
  DAY_ANNUAL_LEAVE: '당일연차',
  DAY_AM_HALF: '당일오전반차',
  DAY_AM_EARLY_LEAVE: '당일오전조퇴',
  OUTSIDE_WORK: '외근',
  OUTING: '외출',
}

function getStatusLabel(status: string): string {
  if (status.includes(',')) {
    return status.split(',').map(s => STATUS_LABEL[s] || s).join('+')
  }
  return STATUS_LABEL[status] || status
}

function getLeaveDeduction(status: string): Record<string, number> {
  const result: Record<string, number> = {
    annual: 0, amHalf: 0, pmHalf: 0, earlyLeave: 0, outing: 0,
    dayAnnual: 0, dayAmHalf: 0, dayAmEarly: 0,
  }
  const statuses = status.includes(',') ? status.split(',') : [status]
  for (const s of statuses) {
    switch (s) {
      case 'ANNUAL_LEAVE': result.annual++; break
      case 'AM_HALF': result.amHalf++; break
      case 'PM_HALF': result.pmHalf++; break
      case 'EARLY_LEAVE': result.earlyLeave++; break
      case 'OUTING': result.outing++; break
      case 'DAY_ANNUAL_LEAVE': result.dayAnnual++; break
      case 'DAY_AM_HALF': result.dayAmHalf++; break
      case 'DAY_AM_EARLY_LEAVE': result.dayAmEarly++; break
    }
  }
  return result
}

function calcUsedTotal(d: Record<string, number>): number {
  return d.annual * 1 + d.amHalf * 0.5 + d.pmHalf * 0.5 +
    d.earlyLeave * 0.25 + d.dayAnnual * 1 + d.dayAmHalf * 0.5 +
    d.dayAmEarly * 0.25
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자만 다운로드할 수 있습니다.' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')
    const corp = searchParams.get('corp')

    if (!year || !month || !corp) {
      return NextResponse.json({ error: '년/월/법인을 지정해주세요.' }, { status: 400 })
    }

    const employees = await prisma.employee.findMany({
      where: { department: { name: corp }, isActive: true },
      include: { department: true },
      orderBy: { name: 'asc' },
    })

    if (employees.length === 0) {
      return NextResponse.json({ error: `${corp}에 해당하는 직원이 없습니다.` }, { status: 404 })
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, -9))
    const endOfMonth = new Date(Date.UTC(year, month, 0, 14, 59, 59, 999))

    const records = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: employees.map(e => e.id) },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { date: 'asc' },
    })

    const empRecordMap: Record<string, Record<number, { status: string; checkIn: Date | null }>> = {}
    for (const r of records) {
      if (!empRecordMap[r.employeeId]) empRecordMap[r.employeeId] = {}
      const kst = new Date(r.date.getTime() + 9 * 60 * 60 * 1000)
      const day = kst.getDate()
      empRecordMap[r.employeeId][day] = { status: r.status, checkIn: r.checkIn }
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']

    const wb = utils.book_new()
    const data: (string | number | null)[][] = []

    data.push([])

    const titleRow: (string | number | null)[] = Array(32 + daysInMonth).fill('')
    titleRow[2] = '■ 근태 현황'
    data.push(titleRow)

    const header1: (string | number | null)[] = Array(32 + daysInMonth).fill('')
    header1[1] = 'NO'
    header1[2] = '부서'
    header1[3] = '이름'
    header1[4] = '입사일'
    header1[5] = '기초 연차'
    header1[6] = '당월 연차'
    header1[15] = '기말 연차'
    header1[16] = '당일 연,오전반차'
    header1[18] = '지각'
    header1[20] = '정상'
    header1[21] = '조퇴'
    header1[22] = '외출'
    header1[23] = '결근'
    header1[24] = '산전후휴가'
    header1[25] = '육아휴직'
    header1[26] = '휴직'
    header1[27] = '경조'
    header1[28] = '휴일근무'
    header1[29] = '출장'
    header1[30] = '훈련'
    header1[31] = '리프레쉬휴가'
    for (let d = 1; d <= daysInMonth; d++) {
      header1[31 + d] = d
    }
    data.push(header1)

    const header2: (string | number | null)[] = Array(32 + daysInMonth).fill('')
    header2[4] = '▼'
    header2[6] = '연차'
    header2[7] = '오전반차'
    header2[8] = '오후반차'
    header2[9] = '조퇴'
    header2[10] = '외출'
    header2[11] = '당일연차'
    header2[12] = '당일오전반차'
    header2[13] = '당일오전조퇴'
    header2[14] = '사용 계'
    header2[16] = '횟수'
    header2[17] = '누계'
    header2[18] = '당월'
    header2[19] = '누계'
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d)
      header2[31 + d] = dayNames[date.getDay()]
    }
    data.push(header2)

    let totalAnnual = 0, totalAmHalf = 0, totalPmHalf = 0, totalEarly = 0, totalOuting = 0
    let totalDayAnnual = 0, totalDayAmHalf = 0, totalDayAmEarly = 0, totalUsed = 0
    let totalDayHalfCount = 0
    let totalLateMonth = 0, totalNormal = 0, totalEarlyCount = 0, totalOutingCount = 0, totalAbsent = 0

    employees.forEach((emp, idx) => {
      const row: (string | number | null)[] = Array(32 + daysInMonth).fill('')
      row[1] = idx + 1
      row[2] = emp.department?.name || ''
      row[3] = emp.name
      row[4] = ''
      row[5] = ''

      const dayMap = empRecordMap[emp.id] || {}

      const monthly = {
        annual: 0, amHalf: 0, pmHalf: 0, earlyLeave: 0, outing: 0,
        dayAnnual: 0, dayAmHalf: 0, dayAmEarly: 0,
        late: 0, normal: 0, absent: 0, earlyLeaveCount: 0, outingCount: 0,
        dayHalfCount: 0,
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const rec = dayMap[d]
        if (!rec) {
          row[31 + d] = ''
          continue
        }

        const label = getStatusLabel(rec.status)
        row[31 + d] = label

        const deduction = getLeaveDeduction(rec.status)
        monthly.annual += deduction.annual
        monthly.amHalf += deduction.amHalf
        monthly.pmHalf += deduction.pmHalf
        monthly.earlyLeave += deduction.earlyLeave
        monthly.outing += deduction.outing
        monthly.dayAnnual += deduction.dayAnnual
        monthly.dayAmHalf += deduction.dayAmHalf
        monthly.dayAmEarly += deduction.dayAmEarly

        monthly.dayHalfCount += deduction.dayAnnual + deduction.dayAmHalf

        const statuses = rec.status.includes(',') ? rec.status.split(',') : [rec.status]
        for (const s of statuses) {
          if (s === 'NORMAL') monthly.normal++
          if (s === 'LATE') { monthly.late++; monthly.normal++ }
          if (s === 'ABSENT') monthly.absent++
          if (s === 'EARLY_LEAVE' || s === 'DAY_AM_EARLY_LEAVE') monthly.earlyLeaveCount++
          if (s === 'OUTING') monthly.outingCount++
        }
      }

      const usedTotal = calcUsedTotal({
        annual: monthly.annual, amHalf: monthly.amHalf, pmHalf: monthly.pmHalf,
        earlyLeave: monthly.earlyLeave, dayAnnual: monthly.dayAnnual,
        dayAmHalf: monthly.dayAmHalf, dayAmEarly: monthly.dayAmEarly, outing: 0,
      })

      row[6] = monthly.annual
      row[7] = monthly.amHalf
      row[8] = monthly.pmHalf
      row[9] = monthly.earlyLeave
      row[10] = monthly.outing
      row[11] = monthly.dayAnnual
      row[12] = monthly.dayAmHalf
      row[13] = monthly.dayAmEarly
      row[14] = usedTotal
      row[15] = ''
      row[16] = monthly.dayHalfCount
      row[17] = ''
      row[18] = monthly.late
      row[19] = ''
      row[20] = monthly.normal
      row[21] = monthly.earlyLeaveCount
      row[22] = monthly.outingCount
      row[23] = monthly.absent
      for (let i = 24; i <= 31; i++) row[i] = 0

      totalAnnual += monthly.annual
      totalAmHalf += monthly.amHalf
      totalPmHalf += monthly.pmHalf
      totalEarly += monthly.earlyLeave
      totalOuting += monthly.outing
      totalDayAnnual += monthly.dayAnnual
      totalDayAmHalf += monthly.dayAmHalf
      totalDayAmEarly += monthly.dayAmEarly
      totalUsed += usedTotal
      totalDayHalfCount += monthly.dayHalfCount
      totalLateMonth += monthly.late
      totalNormal += monthly.normal
      totalEarlyCount += monthly.earlyLeaveCount
      totalOutingCount += monthly.outingCount
      totalAbsent += monthly.absent

      data.push(row)
    })

    const ttlRow: (string | number | null)[] = Array(32 + daysInMonth).fill('')
    ttlRow[1] = 'TTL'
    ttlRow[6] = totalAnnual
    ttlRow[7] = totalAmHalf
    ttlRow[8] = totalPmHalf
    ttlRow[9] = totalEarly
    ttlRow[10] = totalOuting
    ttlRow[11] = totalDayAnnual
    ttlRow[12] = totalDayAmHalf
    ttlRow[13] = totalDayAmEarly
    ttlRow[14] = totalUsed
    ttlRow[16] = totalDayHalfCount
    ttlRow[18] = totalLateMonth
    ttlRow[20] = totalNormal
    ttlRow[21] = totalEarlyCount
    ttlRow[22] = totalOutingCount
    ttlRow[23] = totalAbsent
    data.push(ttlRow)

    const ws = utils.aoa_to_sheet(data)

    const colWidths: { wch: number }[] = []
    colWidths[0] = { wch: 2 }
    colWidths[1] = { wch: 4 }
    colWidths[2] = { wch: 12 }
    colWidths[3] = { wch: 15 }
    colWidths[4] = { wch: 10 }
    colWidths[5] = { wch: 8 }
    for (let i = 6; i <= 14; i++) colWidths[i] = { wch: 8 }
    colWidths[15] = { wch: 8 }
    for (let i = 16; i <= 31; i++) colWidths[i] = { wch: 6 }
    for (let d = 1; d <= daysInMonth; d++) colWidths[31 + d] = { wch: 8 }
    ws['!cols'] = colWidths

    const sheetName = `${month}월`
    utils.book_append_sheet(wb, ws, sheetName)

    const buf = write(wb, { type: 'buffer', bookType: 'xlsx' })

    const fileName = encodeURIComponent(`${year}년_${String(month).padStart(2, '0')}월 ${corp} 근태현황.xlsx`)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: '다운로드 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
