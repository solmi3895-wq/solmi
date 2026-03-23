import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

function parseTimeStr(str: string): string | null {
  if (!str || str === '00:00') return null
  const parts = str.split(':')
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null
  return `${h}h${m}m`
}

function parseHoursMinutes(str: string): number {
  if (!str || str === '00:00') return 0
  const parts = str.split(':')
  return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)

    let imported = 0
    let skipped = 0
    const departments = new Map<string, string>()
    const employees = new Map<string, string>()

    for (const row of rows) {
      const deptName = row['조직']
      const name = row['이름']
      const employeeNumber = row['사원번호'] || ''
      const dateStr = row['근무일자']
      const checkInStr = row['출근시간'] || ''
      const checkOutStr = row['퇴근시간'] || ''
      const checkInStatus = row['출근판정'] || ''
      const checkOutStatus = row['퇴근판정'] || ''
      const overtimeStr = row['연장근무시간'] || '00:00'
      const totalWorkStr = row['총근무시간'] || '00:00'
      const normalWorkStr = row['정상근무시간'] || '00:00'
      const shiftType = row['근무조'] || '일반근무'
      const lateTimeStr = row['지각시간'] || '00:00'

      if (!deptName || !name || !dateStr) {
        skipped++
        continue
      }

      // Upsert department
      if (!departments.has(deptName)) {
        const dept = await prisma.department.upsert({
          where: { name: deptName },
          create: { name: deptName },
          update: {},
        })
        departments.set(deptName, dept.id)
      }
      const deptId = departments.get(deptName)!

      // Upsert employee (use name as fallback key if no employee number)
      const empKey = employeeNumber || `${deptName}-${name}`
      if (!employees.has(empKey)) {
        const existing = employeeNumber
          ? await prisma.employee.findUnique({ where: { employeeNumber } })
          : await prisma.employee.findFirst({ where: { name, departmentId: deptId } })

        if (existing) {
          employees.set(empKey, existing.id)
        } else {
          const emp = await prisma.employee.create({
            data: {
              employeeNumber: employeeNumber || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name,
              departmentId: deptId,
              shiftType: 'SHIFT_9',
            },
          })
          employees.set(empKey, emp.id)
        }
      }
      const empId = employees.get(empKey)!

      // Parse date and times
      const date = new Date(dateStr)
      date.setHours(0, 0, 0, 0)

      const checkIn = checkInStr ? new Date(checkInStr) : null
      const checkOut = checkOutStr ? new Date(checkOutStr) : null

      // Determine status
      let status = 'NORMAL'
      if (checkInStatus === '결근') status = 'ABSENT'
      else if (checkInStatus === '지각') status = 'LATE'
      else if (lateTimeStr !== '00:00') status = 'LATE'

      const workHours = parseHoursMinutes(totalWorkStr)
      const overtime = parseHoursMinutes(overtimeStr)
      const isAnomaly = (checkIn !== null && checkOut === null && status !== 'ABSENT') ||
                        (checkIn === null && checkOut !== null)

      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: empId, date } },
        create: {
          employeeId: empId, date, checkIn, checkOut,
          shiftType: 'SHIFT_9', workHours, overtime, status, isAnomaly,
        },
        update: { checkIn, checkOut, workHours, overtime, status, isAnomaly },
      })
      imported++
    }

    return NextResponse.json({ imported, skipped, total: rows.length })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: '파일 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
