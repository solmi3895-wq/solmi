import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaNeon(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  // 기존 데이터 정리
  await prisma.accessLog.deleteMany()
  await prisma.attendanceRecord.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.department.deleteMany()
  await prisma.systemSetting.deleteMany()

  // 부서 생성
  const engineering = await prisma.department.create({
    data: { name: '개발팀' },
  })
  const marketing = await prisma.department.create({
    data: { name: '마케팅팀' },
  })
  const hr = await prisma.department.create({
    data: { name: '인사팀' },
  })
  const sales = await prisma.department.create({
    data: { name: '영업팀' },
  })

  // 직원 생성 (부서별 5명씩, 총 20명)
  const departments = [engineering, marketing, hr, sales]
  const shifts = ['SHIFT_8', 'SHIFT_9', 'SHIFT_10']
  const positions = ['사원', '대리', '과장', '차장', '부장']

  const employees = []
  let empNum = 1001

  for (const dept of departments) {
    for (let i = 0; i < 5; i++) {
      const emp = await prisma.employee.create({
        data: {
          employeeNumber: `EMP${empNum}`,
          name: `직원${empNum}`,
          departmentId: dept.id,
          shiftType: shifts[i % 3],
          position: positions[i],
        },
      })
      employees.push(emp)
      empNum++
    }
  }

  // 최근 5일간 출입 기록 생성
  const today = new Date()
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)

    // 주말 제외
    if (date.getDay() === 0 || date.getDay() === 6) continue

    for (const emp of employees) {
      const shiftHour = emp.shiftType === 'SHIFT_8' ? 8
        : emp.shiftType === 'SHIFT_9' ? 9 : 10

      // 랜덤 출근 시간 (시차 기준 -10분 ~ +15분)
      const checkInMinuteOffset = Math.floor(Math.random() * 25) - 10
      const checkIn = new Date(date)
      checkIn.setHours(shiftHour, checkInMinuteOffset, 0, 0)

      // 퇴근: 출근 + 9시간 (점심 포함)
      const checkOut = new Date(checkIn)
      checkOut.setHours(checkIn.getHours() + 9)

      // IN 기록
      await prisma.accessLog.create({
        data: {
          employeeId: emp.id,
          cardNumber: `CARD-${emp.employeeNumber}`,
          accessTime: checkIn,
          direction: 'IN',
          gateId: 'GATE-1',
        },
      })

      // OUT 기록 (5% 확률로 누락 → 이상근태)
      if (Math.random() > 0.05) {
        await prisma.accessLog.create({
          data: {
            employeeId: emp.id,
            cardNumber: `CARD-${emp.employeeNumber}`,
            accessTime: checkOut,
            direction: 'OUT',
            gateId: 'GATE-1',
          },
        })
      }
    }
  }

  // 기본 시스템 설정
  for (const setting of [
    { key: 'grace_period_minutes', value: '5' },
    { key: 'lunch_break_hours', value: '1' },
    { key: 'standard_work_hours', value: '8' },
  ]) {
    await prisma.systemSetting.create({ data: setting })
  }

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
