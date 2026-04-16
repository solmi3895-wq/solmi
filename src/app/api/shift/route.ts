import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

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

    let updated = 0
    let notFound = 0

    for (const row of rows) {
      const name = row['이름']
      const shiftStr = row['근무조']
      if (!name || !shiftStr) continue

      // Map shift string to DB value
      let shiftType = 'SHIFT_9'
      if (shiftStr === '7시30분') shiftType = 'SHIFT_7_30'
      else if (shiftStr === '8시') shiftType = 'SHIFT_8'
      else if (shiftStr === '9시') shiftType = 'SHIFT_9'
      else if (shiftStr === '9시30분') shiftType = 'SHIFT_9_30'
      else if (shiftStr === '10시') shiftType = 'SHIFT_10'

      const employees = await prisma.employee.findMany({ where: { name } })
      if (employees.length > 0) {
        for (const emp of employees) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: { shiftType },
          })
        }
        updated += employees.length
      } else {
        notFound++
      }
    }

    return NextResponse.json({ updated, notFound, total: rows.length })
  } catch (error) {
    console.error('Shift upload error:', error)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다' }, { status: 500 })
  }
}
