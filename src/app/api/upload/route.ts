import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

function parseHoursMinutes(str: string): number {
  if (!str || str === '00:00') return 0
  const parts = str.split(':')
  return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
}

// 양식 자동 감지: 컬럼명으로 판단
function detectFormat(row: Record<string, string>): 'old' | 'new' {
  if ('일자' in row && '부서' in row && '근태구분' in row) return 'new'
  return 'old'
}

// 새 양식: 근태구분 → 상태 매핑
function mapAttendanceType(type: string): string {
  const map: Record<string, string> = {
    '출근': 'NORMAL',
    '정상': 'NORMAL',
    '지각': 'LATE',
    '결근': 'ABSENT',
    '연차': 'ANNUAL_LEAVE',
    '당일연차': 'DAY_ANNUAL_LEAVE',
    '오전반차': 'AM_HALF',
    '오후반차': 'PM_HALF',
    '조퇴': 'EARLY_LEAVE',
    '당일오전조퇴': 'DAY_AM_EARLY_LEAVE',
    '당일오전반차': 'DAY_AM_HALF',
    '외출': 'OUTING',
    '출근 후 외근': 'NORMAL',
    '외근 후 출근': 'NORMAL',
    '외근': 'NORMAL',
  }
  return map[type] || 'NORMAL'
}

// 날짜 문자열 파싱 (20260318 → Date)
function parseDateString(str: string): Date | null {
  if (!str) return null
  const s = String(str).trim()
  // 20260318 형식
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.substring(0, 4))
    const m = parseInt(s.substring(4, 6)) - 1
    const d = parseInt(s.substring(6, 8))
    const date = new Date(y, m, d)
    date.setHours(0, 0, 0, 0)
    return date
  }
  // 기존 형식 (2026-03-18 등)
  const date = new Date(s)
  if (!isNaN(date.getTime())) {
    date.setHours(0, 0, 0, 0)
    return date
  }
  return null
}

// 출근 시간 문자열 파싱 (07:36 → Date)
function parseTimeToDate(dateStr: string, timeStr: string): Date | null {
  if (!timeStr || timeStr === '-' || timeStr === '미등록') return null
  const t = String(timeStr).trim()
  const parts = t.split(':')
  if (parts.length < 2) return null
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return null

  // UTC 기준으로 저장 (KST -9)
  const date = parseDateString(dateStr)
  if (!date) return null
  const utcH = h - 9
  date.setUTCHours(utcH < 0 ? utcH + 24 : utcH, m, 0, 0)
  return date
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

    if (rows.length === 0) {
      return NextResponse.json({ error: '데이터가 없습니다' }, { status: 400 })
    }

    const format = detectFormat(rows[0])
    let imported = 0
    let skipped = 0
    const departments = new Map<string, string>()
    const employees = new Map<string, string>()

    // 새 양식: 같은 사람의 출퇴근 + 휴가 행을 합산하기 위해 먼저 그룹핑
    // 출퇴근 행은 출근시간 정보, 휴가 행은 상태 정보를 가짐
    // 우선순위: 휴가 상태가 있으면 휴가 상태 사용
    type MergedRecord = {
      deptName: string; name: string; employeeNumber: string; dateStr: string
      checkInStr: string; checkOutStr: string; status: string
      workHours: number; overtime: number
    }

    const mergedMap = new Map<string, MergedRecord>()

    for (const row of rows) {
      let deptName: string, name: string, employeeNumber: string, dateStr: string
      let checkInStr: string, checkOutStr: string
      let status: string, workHours: number, overtime: number

      if (format === 'new') {
        // 새 양식
        deptName = row['부서'] || ''
        name = row['이름'] || ''
        employeeNumber = row['ERP사번'] ? String(row['ERP사번']) : ''
        dateStr = row['일자'] ? String(row['일자']) : ''
        checkInStr = row['출근시각'] || ''
        checkOutStr = row['퇴근시각'] || ''
        const attendanceType = row['근태구분'] || ''
        status = mapAttendanceType(attendanceType)
        workHours = 0
        overtime = 0
      } else {
        // 기존 양식
        deptName = row['조직'] || ''
        name = row['이름'] || ''
        employeeNumber = row['사원번호'] ? String(row['사원번호']) : ''
        dateStr = row['근무일자'] || ''
        checkInStr = row['출근시간'] || ''
        checkOutStr = row['퇴근시간'] || ''
        status = '' // 아래에서 판정
        workHours = parseHoursMinutes(row['총근무시간'] || '00:00')
        overtime = parseHoursMinutes(row['연장근무시간'] || '00:00')
      }

      if (!deptName || !name || !dateStr) {
        skipped++
        continue
      }

      const key = `${name}-${employeeNumber || deptName}-${dateStr}`

      if (format === 'new') {
        const existing = mergedMap.get(key)
        if (existing) {
          // 출근 시간 있으면 업데이트
          if (checkInStr && checkInStr !== '-' && checkInStr !== '미등록') {
            existing.checkInStr = checkInStr
          }
          if (checkOutStr && checkOutStr !== '-' && checkOutStr !== '미등록') {
            existing.checkOutStr = checkOutStr
          }
          // 휴가/특수 상태가 있으면 우선 적용 (NORMAL이 아닌 것)
          if (status !== 'NORMAL') {
            if (existing.status !== 'NORMAL' && existing.status !== status) {
              // 두 가지 상태 모두 표시 (예: 오전반차 + 오후반차)
              existing.status = `${existing.status},${status}`
            } else {
              existing.status = status
            }
          }
        } else {
          mergedMap.set(key, { deptName, name, employeeNumber, dateStr, checkInStr, checkOutStr, status, workHours, overtime })
        }
      } else {
        mergedMap.set(key, { deptName, name, employeeNumber, dateStr, checkInStr, checkOutStr, status, workHours, overtime })
      }
    }

    // DB에 저장
    for (const record of mergedMap.values()) {
      const { deptName, name, employeeNumber, dateStr, checkInStr, checkOutStr, workHours, overtime } = record
      let { status } = record

      // Upsert department (기존 양식만 부서 생성, 새 양식은 기존 법인 사용)
      if (format === 'old') {
        if (!departments.has(deptName)) {
          const dept = await prisma.department.upsert({
            where: { name: deptName },
            create: { name: deptName },
            update: {},
          })
          departments.set(deptName, dept.id)
        }
      }

      // Upsert employee
      const empKey = employeeNumber || `${deptName}-${name}`
      if (!employees.has(empKey)) {
        // 1) 사번으로 검색
        let existing = employeeNumber
          ? await prisma.employee.findUnique({ where: { employeeNumber: String(employeeNumber) } })
          : null

        // 2) 이름으로 검색
        if (!existing) {
          existing = await prisma.employee.findFirst({ where: { name } })
        }

        if (existing) {
          // 기존 양식에서만 부서 업데이트
          if (format === 'old') {
            const deptId = departments.get(deptName)!
            if (existing.departmentId !== deptId) {
              await prisma.employee.update({ where: { id: existing.id }, data: { departmentId: deptId } })
            }
          }
          // 사번이 N-이름이었는데 실제 사번이 들어온 경우 업데이트
          if (employeeNumber && existing.employeeNumber.startsWith('N-')) {
            await prisma.employee.update({ where: { id: existing.id }, data: { employeeNumber: String(employeeNumber) } })
          }
          employees.set(empKey, existing.id)
        } else if (format === 'old') {
          // 기존 양식에서만 새 직원 생성
          const deptId = departments.get(deptName)!
          const empNumber = employeeNumber ? String(employeeNumber) : `N-${name}`
          const duplicateCheck = await prisma.employee.findUnique({ where: { employeeNumber: empNumber } })
          if (duplicateCheck) {
            employees.set(empKey, duplicateCheck.id)
          } else {
            const emp = await prisma.employee.create({
              data: {
                employeeNumber: empNumber,
                name,
                departmentId: deptId,
                shiftType: 'SHIFT_9',
              },
            })
            employees.set(empKey, emp.id)
          }
        } else {
          // 새 양식: 기존 직원 DB에 없는 사람은 스킵
          skipped++
          continue
        }
      }
      const empId = employees.get(empKey)
      if (!empId) { skipped++; continue }

      // Parse date and times
      const date = parseDateString(dateStr)
      if (!date) { skipped++; continue }

      let checkIn: Date | null = null
      let checkOut: Date | null = null

      if (format === 'new') {
        // 새 양식: HH:MM 시간만 있음
        checkIn = parseTimeToDate(dateStr, checkInStr)
        checkOut = parseTimeToDate(dateStr, checkOutStr)
      } else {
        // 기존 양식: full datetime
        checkIn = checkInStr ? new Date(checkInStr) : null
        checkOut = checkOutStr ? new Date(checkOutStr) : null
      }

      // 기존 양식에서 status가 비어있으면 출근시간 기준으로 판정
      if (!status || (format === 'old' && status === '')) {
        if (!checkIn) {
          status = 'ABSENT'
        } else {
          const emp = await prisma.employee.findUnique({ where: { id: empId } })
          const shiftHourMap: Record<string, number> = { SHIFT_8: 8, SHIFT_9: 9, SHIFT_10: 10 }
          const shiftHour = shiftHourMap[emp?.shiftType || 'SHIFT_9'] || 9
          const kstHour = (checkIn.getUTCHours() + 9) % 24
          const kstMin = checkIn.getUTCMinutes()
          if (kstHour > shiftHour || (kstHour === shiftHour && kstMin >= 1)) {
            status = 'LATE'
          } else {
            status = 'NORMAL'
          }
        }
      }

      // 새 양식에서 출근 기록 있는데 status가 NORMAL인 경우에도 지각 체크
      if (format === 'new' && status === 'NORMAL' && checkIn) {
        const emp = await prisma.employee.findUnique({ where: { id: empId } })
        const shiftHourMap: Record<string, number> = { SHIFT_8: 8, SHIFT_9: 9, SHIFT_10: 10 }
        const shiftHour = shiftHourMap[emp?.shiftType || 'SHIFT_9'] || 9
        const kstHour = (checkIn.getUTCHours() + 9) % 24
        const kstMin = checkIn.getUTCMinutes()
        if (kstHour > shiftHour || (kstHour === shiftHour && kstMin >= 1)) {
          status = 'LATE'
        }
      }

      const isAnomaly = (checkIn !== null && checkOut === null && status === 'NORMAL') ||
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

    return NextResponse.json({ imported, skipped, total: rows.length, format })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: '파일 처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
