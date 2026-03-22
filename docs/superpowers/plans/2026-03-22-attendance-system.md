# 근태 관리 시스템 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드 출입 단말기 DB에서 출퇴근 데이터를 자동 집계하여 웹 대시보드로 시각화하는 근태 관리 시스템 구축

**Architecture:** Next.js App Router 풀스택 앱. PostgreSQL(Prisma ORM)에 출입 기록을 동기화하고, 시차출퇴근제(8/9/10시) 기준으로 자동 집계. 웹 대시보드에서 실시간 현황, 근태 조회, 리포트(엑셀 다운로드) 제공.

**Tech Stack:** Next.js 14+, TypeScript, PostgreSQL, Prisma, Tailwind CSS, shadcn/ui, Recharts, ExcelJS, Vitest

**Spec:** `docs/superpowers/specs/` (plan file에 통합)

---

## File Structure

```
selfish-test/
├── prisma/
│   ├── schema.prisma                    # DB 스키마 정의
│   └── seed.ts                          # 테스트용 seed 데이터
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # 루트 레이아웃 (사이드바 포함)
│   │   ├── page.tsx                     # 대시보드 메인 페이지
│   │   ├── attendance/
│   │   │   └── page.tsx                 # 근태 조회 페이지
│   │   ├── reports/
│   │   │   └── page.tsx                 # 리포트 페이지
│   │   ├── settings/
│   │   │   └── page.tsx                 # 관리자 설정 페이지
│   │   └── api/
│   │       ├── dashboard/route.ts       # 대시보드 데이터 API
│   │       ├── attendance/route.ts      # 근태 조회 API
│   │       ├── reports/
│   │       │   ├── route.ts             # 리포트 데이터 API
│   │       │   └── excel/route.ts       # 엑셀 다운로드 API
│   │       ├── employees/route.ts       # 직원 CRUD API
│   │       ├── departments/route.ts     # 부서 CRUD API
│   │       └── sync/route.ts            # 동기화 트리거 API
│   ├── lib/
│   │   ├── db.ts                        # Prisma client singleton
│   │   ├── attendance.ts                # 근태 집계 비즈니스 로직
│   │   ├── sync.ts                      # 카드 단말기 DB 동기화 로직
│   │   └── excel.ts                     # 엑셀 파일 생성
│   └── components/
│       ├── layout/
│       │   ├── sidebar.tsx              # 사이드바 네비게이션
│       │   └── header.tsx               # 상단 헤더
│       ├── dashboard/
│       │   ├── stat-cards.tsx           # 출근/미출근/지각 카드
│       │   ├── department-chart.tsx     # 부서별 출근율 차트
│       │   ├── anomaly-list.tsx         # 이상 근태 알림 리스트
│       │   └── shift-distribution.tsx   # 시차출퇴근 분포 차트
│       ├── attendance/
│       │   ├── attendance-table.tsx     # 근태 테이블
│       │   └── attendance-filter.tsx    # 필터 컴포넌트
│       └── ui/                          # shadcn/ui 컴포넌트 (자동 생성)
├── tests/
│   ├── lib/
│   │   ├── attendance.test.ts           # 근태 집계 로직 테스트
│   │   └── excel.test.ts               # 엑셀 생성 테스트
│   └── api/
│       ├── dashboard.test.ts            # 대시보드 API 테스트
│       └── attendance.test.ts           # 근태 API 테스트
├── .env                                 # 환경변수
├── .env.example                         # 환경변수 예시
├── vitest.config.ts                     # 테스트 설정
├── package.json
└── tsconfig.json
```

---

## Task 1: 프로젝트 초기화

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `.env`, `.env.example`, `.gitignore`

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
cd "/c/Users/오솔미/OneDrive/바탕 화면/PROJECT/selfish-test"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: 프로젝트 파일들 생성됨

- [ ] **Step 2: Git 초기화**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js project"
```

- [ ] **Step 3: 추가 의존성 설치**

```bash
npm install prisma @prisma/client recharts exceljs date-fns
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: 환경변수 파일 생성**

Create `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/attendance_db"
CARD_DB_URL="postgresql://user:pass@card-server:5432/card_db"
GRACE_PERIOD_MINUTES=5
```

Create `.env.example`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/attendance_db"
CARD_DB_URL="postgresql://user:pass@card-server:5432/card_db"
GRACE_PERIOD_MINUTES=5
```

- [ ] **Step 5: Vitest 설정**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add dependencies and vitest config"
```

---

## Task 2: Prisma 스키마 & DB 설정

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`

- [ ] **Step 1: Prisma 초기화**

```bash
npx prisma init
```

- [ ] **Step 2: 스키마 작성**

Write `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ShiftType {
  SHIFT_8
  SHIFT_9
  SHIFT_10
}

enum Direction {
  IN
  OUT
}

enum AttendanceStatus {
  NORMAL
  LATE
  ABSENT
  EARLY_LEAVE
}

model Department {
  id        String       @id @default(uuid())
  name      String
  parentId  String?      @map("parent_id")
  parent    Department?  @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children  Department[] @relation("DepartmentHierarchy")
  employees Employee[]
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")

  @@map("departments")
}

model Employee {
  id               String             @id @default(uuid())
  employeeNumber   String             @unique @map("employee_number")
  name             String
  departmentId     String             @map("department_id")
  department       Department         @relation(fields: [departmentId], references: [id])
  shiftType        ShiftType          @default(SHIFT_9) @map("shift_type")
  position         String?
  isActive         Boolean            @default(true) @map("is_active")
  accessLogs       AccessLog[]
  attendanceRecords AttendanceRecord[]
  createdAt        DateTime           @default(now()) @map("created_at")
  updatedAt        DateTime           @updatedAt @map("updated_at")

  @@map("employees")
}

model AccessLog {
  id         String    @id @default(uuid())
  employeeId String    @map("employee_id")
  employee   Employee  @relation(fields: [employeeId], references: [id])
  cardNumber String    @map("card_number")
  accessTime DateTime  @map("access_time")
  direction  Direction
  gateId     String?   @map("gate_id")
  syncedAt   DateTime  @default(now()) @map("synced_at")

  @@index([employeeId, accessTime])
  @@map("access_logs")
}

model AttendanceRecord {
  id         String           @id @default(uuid())
  employeeId String           @map("employee_id")
  employee   Employee         @relation(fields: [employeeId], references: [id])
  date       DateTime         @db.Date
  checkIn    DateTime?        @map("check_in")
  checkOut   DateTime?        @map("check_out")
  shiftType  ShiftType        @map("shift_type")
  workHours  Decimal?         @map("work_hours") @db.Decimal(4, 2)
  overtime   Decimal?         @db.Decimal(4, 2)
  status     AttendanceStatus @default(NORMAL)
  isAnomaly  Boolean          @default(false) @map("is_anomaly")
  createdAt  DateTime         @default(now()) @map("created_at")
  updatedAt  DateTime         @updatedAt @map("updated_at")

  @@unique([employeeId, date])
  @@map("attendance_records")
}

model SystemSetting {
  id    String @id @default(uuid())
  key   String @unique
  value String

  @@map("system_settings")
}
```

- [ ] **Step 3: Prisma client singleton 작성**

Write `src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: DB 마이그레이션 실행**

```bash
npx prisma migrate dev --name init
```

Expected: Migration 생성 및 적용 완료

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with all models and DB client"
```

---

## Task 3: Seed 데이터 생성

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (prisma seed 설정)

- [ ] **Step 1: Seed 파일 작성**

Write `prisma/seed.ts`:
```typescript
import { PrismaClient, ShiftType, Direction } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
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
  const shifts: ShiftType[] = ['SHIFT_8', 'SHIFT_9', 'SHIFT_10']
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
  await prisma.systemSetting.createMany({
    data: [
      { key: 'grace_period_minutes', value: '5' },
      { key: 'lunch_break_hours', value: '1' },
      { key: 'standard_work_hours', value: '8' },
    ],
  })

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
```

- [ ] **Step 2: package.json에 seed 설정 추가**

`package.json`에 추가:
```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 3: Seed 실행**

```bash
npm install -D tsx
npx prisma db seed
```

Expected: "Seed data created successfully"

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add seed data with sample employees and access logs"
```

---

## Task 4: 근태 집계 비즈니스 로직 (TDD)

**Files:**
- Create: `src/lib/attendance.ts`, `tests/lib/attendance.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

Write `tests/lib/attendance.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  determineCheckInOut,
  calculateWorkHours,
  determineStatus,
  getShiftStartTime,
} from '@/lib/attendance'

describe('getShiftStartTime', () => {
  it('SHIFT_8은 8시를 반환', () => {
    expect(getShiftStartTime('SHIFT_8')).toBe(8)
  })
  it('SHIFT_9는 9시를 반환', () => {
    expect(getShiftStartTime('SHIFT_9')).toBe(9)
  })
  it('SHIFT_10은 10시를 반환', () => {
    expect(getShiftStartTime('SHIFT_10')).toBe(10)
  })
})

describe('determineCheckInOut', () => {
  it('IN 기록들 중 가장 이른 시간이 출근', () => {
    const logs = [
      { direction: 'IN' as const, accessTime: new Date('2026-03-22T09:05:00') },
      { direction: 'IN' as const, accessTime: new Date('2026-03-22T09:00:00') },
      { direction: 'OUT' as const, accessTime: new Date('2026-03-22T18:00:00') },
    ]
    const result = determineCheckInOut(logs)
    expect(result.checkIn?.getHours()).toBe(9)
    expect(result.checkIn?.getMinutes()).toBe(0)
  })

  it('OUT 기록들 중 가장 늦은 시간이 퇴근', () => {
    const logs = [
      { direction: 'IN' as const, accessTime: new Date('2026-03-22T09:00:00') },
      { direction: 'OUT' as const, accessTime: new Date('2026-03-22T18:00:00') },
      { direction: 'OUT' as const, accessTime: new Date('2026-03-22T18:30:00') },
    ]
    const result = determineCheckInOut(logs)
    expect(result.checkOut?.getHours()).toBe(18)
    expect(result.checkOut?.getMinutes()).toBe(30)
  })

  it('IN만 있고 OUT이 없으면 isAnomaly = true', () => {
    const logs = [
      { direction: 'IN' as const, accessTime: new Date('2026-03-22T09:00:00') },
    ]
    const result = determineCheckInOut(logs)
    expect(result.checkIn).toBeDefined()
    expect(result.checkOut).toBeNull()
    expect(result.isAnomaly).toBe(true)
  })

  it('기록이 없으면 둘 다 null', () => {
    const result = determineCheckInOut([])
    expect(result.checkIn).toBeNull()
    expect(result.checkOut).toBeNull()
  })
})

describe('calculateWorkHours', () => {
  it('9시 출근 18시 퇴근 = 8시간 (점심 1시간 제외)', () => {
    const checkIn = new Date('2026-03-22T09:00:00')
    const checkOut = new Date('2026-03-22T18:00:00')
    expect(calculateWorkHours(checkIn, checkOut)).toBe(8)
  })

  it('9시 출근 20시 퇴근 = 10시간 (점심 제외)', () => {
    const checkIn = new Date('2026-03-22T09:00:00')
    const checkOut = new Date('2026-03-22T20:00:00')
    expect(calculateWorkHours(checkIn, checkOut)).toBe(10)
  })

  it('퇴근이 없으면 null 반환', () => {
    const checkIn = new Date('2026-03-22T09:00:00')
    expect(calculateWorkHours(checkIn, null)).toBeNull()
  })
})

describe('determineStatus', () => {
  it('정시 출근 = NORMAL', () => {
    const checkIn = new Date('2026-03-22T09:00:00')
    expect(determineStatus(checkIn, 'SHIFT_9', 5)).toBe('NORMAL')
  })

  it('유예시간 내 출근 = NORMAL', () => {
    const checkIn = new Date('2026-03-22T09:04:00')
    expect(determineStatus(checkIn, 'SHIFT_9', 5)).toBe('NORMAL')
  })

  it('유예시간 초과 출근 = LATE', () => {
    const checkIn = new Date('2026-03-22T09:06:00')
    expect(determineStatus(checkIn, 'SHIFT_9', 5)).toBe('LATE')
  })

  it('8시 시차 직원이 8:03 출근 = NORMAL', () => {
    const checkIn = new Date('2026-03-22T08:03:00')
    expect(determineStatus(checkIn, 'SHIFT_8', 5)).toBe('NORMAL')
  })

  it('10시 시차 직원이 10:10 출근 = LATE', () => {
    const checkIn = new Date('2026-03-22T10:10:00')
    expect(determineStatus(checkIn, 'SHIFT_10', 5)).toBe('LATE')
  })

  it('출근 기록 없으면 ABSENT', () => {
    expect(determineStatus(null, 'SHIFT_9', 5)).toBe('ABSENT')
  })
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
npx vitest run tests/lib/attendance.test.ts
```

Expected: FAIL — 모듈이 존재하지 않음

- [ ] **Step 3: 비즈니스 로직 구현**

Write `src/lib/attendance.ts`:
```typescript
import { ShiftType, AttendanceStatus } from '@prisma/client'

type AccessLogEntry = {
  direction: 'IN' | 'OUT'
  accessTime: Date
}

type CheckInOutResult = {
  checkIn: Date | null
  checkOut: Date | null
  isAnomaly: boolean
}

export function getShiftStartTime(shiftType: ShiftType): number {
  switch (shiftType) {
    case 'SHIFT_8': return 8
    case 'SHIFT_9': return 9
    case 'SHIFT_10': return 10
  }
}

export function determineCheckInOut(logs: AccessLogEntry[]): CheckInOutResult {
  if (logs.length === 0) {
    return { checkIn: null, checkOut: null, isAnomaly: false }
  }

  const inLogs = logs.filter((l) => l.direction === 'IN')
  const outLogs = logs.filter((l) => l.direction === 'OUT')

  const checkIn = inLogs.length > 0
    ? inLogs.reduce((earliest, log) =>
        log.accessTime < earliest.accessTime ? log : earliest
      ).accessTime
    : null

  const checkOut = outLogs.length > 0
    ? outLogs.reduce((latest, log) =>
        log.accessTime > latest.accessTime ? log : latest
      ).accessTime
    : null

  const isAnomaly = (checkIn !== null && checkOut === null) ||
                    (checkIn === null && checkOut !== null)

  return { checkIn, checkOut, isAnomaly }
}

export function calculateWorkHours(
  checkIn: Date,
  checkOut: Date | null,
  lunchBreakHours: number = 1
): number | null {
  if (!checkOut) return null

  const diffMs = checkOut.getTime() - checkIn.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  return Math.max(0, diffHours - lunchBreakHours)
}

export function determineStatus(
  checkIn: Date | null,
  shiftType: ShiftType,
  gracePeriodMinutes: number
): AttendanceStatus {
  if (!checkIn) return 'ABSENT'

  const shiftStart = getShiftStartTime(shiftType)
  const checkInHour = checkIn.getHours()
  const checkInMinute = checkIn.getMinutes()
  const totalMinutes = checkInHour * 60 + checkInMinute
  const shiftMinutes = shiftStart * 60 + gracePeriodMinutes

  if (totalMinutes <= shiftMinutes) {
    return 'NORMAL'
  }

  return 'LATE'
}

export function calculateOvertime(
  workHours: number | null,
  standardHours: number = 8
): number {
  if (workHours === null) return 0
  return Math.max(0, workHours - standardHours)
}
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

```bash
npx vitest run tests/lib/attendance.test.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/attendance.ts tests/lib/attendance.test.ts
git commit -m "feat: add attendance business logic with TDD (shift detection, work hours, status)"
```

---

## Task 5: 대시보드 API

**Files:**
- Create: `src/app/api/dashboard/route.ts`

- [ ] **Step 1: 대시보드 API 작성**

Write `src/app/api/dashboard/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // 전체 활성 직원 수
  const totalEmployees = await prisma.employee.count({
    where: { isActive: true },
  })

  // 오늘 출근 기록
  const todayRecords = await prisma.attendanceRecord.findMany({
    where: {
      date: today,
    },
    include: {
      employee: {
        include: { department: true },
      },
    },
  })

  const checkedIn = todayRecords.filter((r) => r.checkIn !== null).length
  const late = todayRecords.filter((r) => r.status === 'LATE').length
  const absent = totalEmployees - checkedIn
  const anomalies = todayRecords.filter((r) => r.isAnomaly)

  // 부서별 출근율
  const departments = await prisma.department.findMany({
    include: {
      employees: {
        where: { isActive: true },
        include: {
          attendanceRecords: {
            where: { date: today },
          },
        },
      },
    },
  })

  const departmentStats = departments.map((dept) => {
    const total = dept.employees.length
    const present = dept.employees.filter(
      (emp) => emp.attendanceRecords.some((r) => r.checkIn !== null)
    ).length
    return {
      name: dept.name,
      total,
      present,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    }
  })

  // 시차출퇴근 분포
  const shiftDistribution = {
    SHIFT_8: todayRecords.filter((r) => r.shiftType === 'SHIFT_8').length,
    SHIFT_9: todayRecords.filter((r) => r.shiftType === 'SHIFT_9').length,
    SHIFT_10: todayRecords.filter((r) => r.shiftType === 'SHIFT_10').length,
  }

  return NextResponse.json({
    summary: { totalEmployees, checkedIn, late, absent },
    departmentStats,
    shiftDistribution,
    anomalies: anomalies.map((a) => ({
      id: a.id,
      employeeName: a.employee.name,
      employeeNumber: a.employee.employeeNumber,
      department: a.employee.department.name,
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      status: a.status,
    })),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/route.ts
git commit -m "feat: add dashboard API with summary, department stats, shift distribution"
```

---

## Task 6: 근태 조회 API

**Files:**
- Create: `src/app/api/attendance/route.ts`

- [ ] **Step 1: 근태 조회 API 작성**

Write `src/app/api/attendance/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const departmentId = searchParams.get('departmentId')
  const status = searchParams.get('status')
  const shiftType = searchParams.get('shiftType')
  const employeeId = searchParams.get('employeeId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where: Record<string, unknown> = {}

  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    }
  }

  if (employeeId) {
    where.employeeId = employeeId
  }

  if (departmentId) {
    where.employee = { departmentId }
  }

  if (status) {
    where.status = status
  }

  if (shiftType) {
    where.shiftType = shiftType
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          include: { department: true },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ])

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      date: r.date,
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      employeeNumber: r.employee.employeeNumber,
      department: r.employee.department.name,
      shiftType: r.shiftType,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      workHours: r.workHours ? Number(r.workHours) : null,
      overtime: r.overtime ? Number(r.overtime) : null,
      status: r.status,
      isAnomaly: r.isAnomaly,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/attendance/route.ts
git commit -m "feat: add attendance query API with filtering and pagination"
```

---

## Task 7: 리포트 & 엑셀 다운로드 API

**Files:**
- Create: `src/lib/excel.ts`, `src/app/api/reports/route.ts`, `src/app/api/reports/excel/route.ts`

- [ ] **Step 1: 엑셀 생성 유틸리티 작성**

Write `src/lib/excel.ts`:
```typescript
import ExcelJS from 'exceljs'

type AttendanceRow = {
  date: string
  employeeNumber: string
  employeeName: string
  department: string
  shiftType: string
  checkIn: string | null
  checkOut: string | null
  workHours: number | null
  overtime: number | null
  status: string
}

export async function generateAttendanceExcel(
  data: AttendanceRow[],
  title: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('근태 리포트')

  // 헤더 스타일
  sheet.columns = [
    { header: '날짜', key: 'date', width: 12 },
    { header: '사번', key: 'employeeNumber', width: 12 },
    { header: '이름', key: 'employeeName', width: 12 },
    { header: '부서', key: 'department', width: 15 },
    { header: '시차유형', key: 'shiftType', width: 12 },
    { header: '출근시간', key: 'checkIn', width: 18 },
    { header: '퇴근시간', key: 'checkOut', width: 18 },
    { header: '근무시간', key: 'workHours', width: 10 },
    { header: '초과근무', key: 'overtime', width: 10 },
    { header: '상태', key: 'status', width: 10 },
  ]

  // 헤더 스타일 적용
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  }
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // 데이터 행 추가
  const shiftLabels: Record<string, string> = {
    SHIFT_8: '8시 출근',
    SHIFT_9: '9시 출근',
    SHIFT_10: '10시 출근',
  }

  const statusLabels: Record<string, string> = {
    NORMAL: '정상',
    LATE: '지각',
    ABSENT: '결근',
    EARLY_LEAVE: '조퇴',
  }

  for (const row of data) {
    sheet.addRow({
      ...row,
      shiftType: shiftLabels[row.shiftType] || row.shiftType,
      status: statusLabels[row.status] || row.status,
      workHours: row.workHours ?? '-',
      overtime: row.overtime ?? '-',
      checkIn: row.checkIn ?? '-',
      checkOut: row.checkOut ?? '-',
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

- [ ] **Step 2: 리포트 데이터 API 작성**

Write `src/app/api/reports/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const month = searchParams.get('month') // YYYY-MM format
  const departmentId = searchParams.get('departmentId')

  if (!month) {
    return NextResponse.json({ error: 'month parameter required' }, { status: 400 })
  }

  const [year, mon] = month.split('-').map(Number)
  const startDate = new Date(year, mon - 1, 1)
  const endDate = new Date(year, mon, 0) // 해당 월 마지막 날

  const where: Record<string, unknown> = {
    date: { gte: startDate, lte: endDate },
  }

  if (departmentId) {
    where.employee = { departmentId }
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      employee: { include: { department: true } },
    },
    orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }],
  })

  // 부서별 통계
  const deptMap = new Map<string, { name: string; total: number; late: number; absent: number; totalHours: number; count: number }>()

  for (const r of records) {
    const deptName = r.employee.department.name
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, { name: deptName, total: 0, late: 0, absent: 0, totalHours: 0, count: 0 })
    }
    const stat = deptMap.get(deptName)!
    stat.total++
    if (r.status === 'LATE') stat.late++
    if (r.status === 'ABSENT') stat.absent++
    if (r.workHours) {
      stat.totalHours += Number(r.workHours)
      stat.count++
    }
  }

  const departmentStats = Array.from(deptMap.values()).map((s) => ({
    ...s,
    lateRate: s.total > 0 ? Math.round((s.late / s.total) * 100) : 0,
    avgWorkHours: s.count > 0 ? Math.round((s.totalHours / s.count) * 10) / 10 : 0,
  }))

  return NextResponse.json({
    month,
    totalRecords: records.length,
    departmentStats,
  })
}
```

- [ ] **Step 3: 엑셀 다운로드 API 작성**

Write `src/app/api/reports/excel/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateAttendanceExcel } from '@/lib/excel'
import { format } from 'date-fns'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const month = searchParams.get('month')

  if (!month) {
    return NextResponse.json({ error: 'month parameter required' }, { status: 400 })
  }

  const [year, mon] = month.split('-').map(Number)
  const startDate = new Date(year, mon - 1, 1)
  const endDate = new Date(year, mon, 0)

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    include: {
      employee: { include: { department: true } },
    },
    orderBy: [{ date: 'asc' }, { employee: { name: 'asc' } }],
  })

  const rows = records.map((r) => ({
    date: format(r.date, 'yyyy-MM-dd'),
    employeeNumber: r.employee.employeeNumber,
    employeeName: r.employee.name,
    department: r.employee.department.name,
    shiftType: r.shiftType,
    checkIn: r.checkIn ? format(r.checkIn, 'HH:mm:ss') : null,
    checkOut: r.checkOut ? format(r.checkOut, 'HH:mm:ss') : null,
    workHours: r.workHours ? Number(r.workHours) : null,
    overtime: r.overtime ? Number(r.overtime) : null,
    status: r.status,
  }))

  const buffer = await generateAttendanceExcel(rows, `${month} 근태 리포트`)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance-${month}.xlsx"`,
    },
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/excel.ts src/app/api/reports/
git commit -m "feat: add report API and Excel download with department statistics"
```

---

## Task 8: 직원/부서 관리 API

**Files:**
- Create: `src/app/api/employees/route.ts`, `src/app/api/departments/route.ts`

- [ ] **Step 1: 직원 API 작성**

Write `src/app/api/employees/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const departmentId = searchParams.get('departmentId')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = { isActive: true }
  if (departmentId) where.departmentId = departmentId
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { employeeNumber: { contains: search } },
    ]
  }

  const employees = await prisma.employee.findMany({
    where,
    include: { department: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(employees)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, shiftType, departmentId, position, isActive } = body

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...(shiftType && { shiftType }),
      ...(departmentId && { departmentId }),
      ...(position !== undefined && { position }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: 부서 API 작성**

Write `src/app/api/departments/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const departments = await prisma.department.findMany({
    include: {
      _count: { select: { employees: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(departments)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/employees/ src/app/api/departments/
git commit -m "feat: add employee and department management APIs"
```

---

## Task 9: 동기화 & 집계 API

**Files:**
- Create: `src/lib/sync.ts`, `src/app/api/sync/route.ts`

- [ ] **Step 1: 동기화/집계 로직 작성**

Write `src/lib/sync.ts`:
```typescript
import { prisma } from '@/lib/db'
import {
  determineCheckInOut,
  calculateWorkHours,
  determineStatus,
  calculateOvertime,
} from '@/lib/attendance'

export async function aggregateAttendance(targetDate: Date) {
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  // 시스템 설정 조회
  const settings = await prisma.systemSetting.findMany()
  const gracePeriod = Number(
    settings.find((s) => s.key === 'grace_period_minutes')?.value || '5'
  )
  const standardHours = Number(
    settings.find((s) => s.key === 'standard_work_hours')?.value || '8'
  )
  const lunchBreak = Number(
    settings.find((s) => s.key === 'lunch_break_hours')?.value || '1'
  )

  // 활성 직원 목록
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
  })

  for (const emp of employees) {
    // 해당 직원의 당일 출입 기록
    const logs = await prisma.accessLog.findMany({
      where: {
        employeeId: emp.id,
        accessTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { accessTime: 'asc' },
    })

    const { checkIn, checkOut, isAnomaly } = determineCheckInOut(logs)
    const status = determineStatus(checkIn, emp.shiftType, gracePeriod)
    const workHours = checkIn ? calculateWorkHours(checkIn, checkOut, lunchBreak) : null
    const overtime = calculateOvertime(workHours, standardHours)

    // upsert: 이미 있으면 업데이트, 없으면 생성
    await prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: emp.id,
          date: startOfDay,
        },
      },
      update: {
        checkIn,
        checkOut,
        shiftType: emp.shiftType,
        workHours,
        overtime,
        status,
        isAnomaly,
      },
      create: {
        employeeId: emp.id,
        date: startOfDay,
        checkIn,
        checkOut,
        shiftType: emp.shiftType,
        workHours,
        overtime,
        status,
        isAnomaly,
      },
    })
  }
}
```

- [ ] **Step 2: 동기화 트리거 API 작성**

Write `src/app/api/sync/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { aggregateAttendance } from '@/lib/sync'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const targetDate = body.date ? new Date(body.date) : new Date()

  try {
    await aggregateAttendance(targetDate)
    return NextResponse.json({
      success: true,
      message: `Aggregation completed for ${targetDate.toISOString().split('T')[0]}`,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.ts src/app/api/sync/route.ts
git commit -m "feat: add attendance aggregation and sync trigger API"
```

---

## Task 10: 레이아웃 & 사이드바

**Files:**
- Create: `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: shadcn/ui 초기화**

```bash
npx shadcn@latest init -d
npx shadcn@latest add card button table badge input select
```

- [ ] **Step 2: 사이드바 컴포넌트 작성**

Write `src/components/layout/sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: '대시보드', icon: '📊' },
  { href: '/attendance', label: '근태 조회', icon: '📋' },
  { href: '/reports', label: '리포트', icon: '📈' },
  { href: '/settings', label: '설정', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-slate-900 text-white p-4">
      <div className="text-xl font-bold mb-8 px-2">근태 관리 시스템</div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: 헤더 컴포넌트 작성**

Write `src/components/layout/header.tsx`:
```typescript
export function Header() {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between">
      <div className="text-sm text-slate-500">{today}</div>
      <div className="text-sm text-slate-600">관리자</div>
    </header>
  )
}
```

- [ ] **Step 4: 루트 레이아웃 수정**

Modify `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '근태 관리 시스템',
  description: '출퇴근 자동 집계 및 관리 대시보드',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6 bg-slate-50">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ src/app/layout.tsx
git commit -m "feat: add sidebar navigation and header layout"
```

---

## Task 11: 대시보드 페이지

**Files:**
- Create: `src/components/dashboard/stat-cards.tsx`, `src/components/dashboard/department-chart.tsx`, `src/components/dashboard/anomaly-list.tsx`, `src/components/dashboard/shift-distribution.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 통계 카드 컴포넌트**

Write `src/components/dashboard/stat-cards.tsx`:
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  summary: {
    totalEmployees: number
    checkedIn: number
    late: number
    absent: number
  }
}

export function StatCards({ summary }: Props) {
  const cards = [
    { title: '전체 직원', value: summary.totalEmployees, color: 'text-slate-700' },
    { title: '출근', value: summary.checkedIn, color: 'text-green-600' },
    { title: '지각', value: summary.late, color: 'text-orange-500' },
    { title: '미출근', value: summary.absent, color: 'text-red-500' },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${card.color}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 부서별 출근율 차트**

Write `src/components/dashboard/department-chart.tsx`:
```typescript
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type DeptStat = {
  name: string
  total: number
  present: number
  rate: number
}

export function DepartmentChart({ data }: { data: DeptStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>부서별 출근율</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip formatter={(value: number) => `${value}%`} />
            <Bar dataKey="rate" fill="#4472C4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 이상 근태 리스트**

Write `src/components/dashboard/anomaly-list.tsx`:
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Anomaly = {
  id: string
  employeeName: string
  employeeNumber: string
  department: string
  checkIn: string | null
  checkOut: string | null
  status: string
}

export function AnomalyList({ anomalies }: { anomalies: Anomaly[] }) {
  const statusLabels: Record<string, string> = {
    NORMAL: '정상',
    LATE: '지각',
    ABSENT: '결근',
    EARLY_LEAVE: '조퇴',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>이상 근태 알림</CardTitle>
      </CardHeader>
      <CardContent>
        {anomalies.length === 0 ? (
          <p className="text-slate-400 text-sm">이상 근태가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {anomalies.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{a.employeeName}</span>
                  <span className="text-slate-400 text-sm ml-2">({a.employeeNumber})</span>
                  <span className="text-slate-400 text-sm ml-2">{a.department}</span>
                </div>
                <Badge variant="destructive">
                  {a.checkIn && !a.checkOut ? '퇴근 미기록' : '출근 미기록'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: 시차출퇴근 분포 차트**

Write `src/components/dashboard/shift-distribution.tsx`:
```typescript
'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {
  distribution: {
    SHIFT_8: number
    SHIFT_9: number
    SHIFT_10: number
  }
}

const COLORS = ['#4472C4', '#ED7D31', '#70AD47']

export function ShiftDistribution({ distribution }: Props) {
  const data = [
    { name: '8시 출근', value: distribution.SHIFT_8 },
    { name: '9시 출근', value: distribution.SHIFT_9 },
    { name: '10시 출근', value: distribution.SHIFT_10 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>시차출퇴근 분포</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={100} dataKey="value" label>
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: 대시보드 메인 페이지 작성**

Write `src/app/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { StatCards } from '@/components/dashboard/stat-cards'
import { DepartmentChart } from '@/components/dashboard/department-chart'
import { AnomalyList } from '@/components/dashboard/anomaly-list'
import { ShiftDistribution } from '@/components/dashboard/shift-distribution'

type DashboardData = {
  summary: { totalEmployees: number; checkedIn: number; late: number; absent: number }
  departmentStats: { name: string; total: number; present: number; rate: number }[]
  shiftDistribution: { SHIFT_8: number; SHIFT_9: number; SHIFT_10: number }
  anomalies: { id: string; employeeName: string; employeeNumber: string; department: string; checkIn: string | null; checkOut: string | null; status: string }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-10">로딩 중...</div>
  if (!data) return <div className="text-center py-10">데이터를 불러올 수 없습니다.</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <StatCards summary={data.summary} />
      <div className="grid grid-cols-2 gap-6">
        <DepartmentChart data={data.departmentStats} />
        <ShiftDistribution distribution={data.shiftDistribution} />
      </div>
      <AnomalyList anomalies={data.anomalies} />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/ src/app/page.tsx
git commit -m "feat: add dashboard page with stat cards, charts, and anomaly list"
```

---

## Task 12: 근태 조회 페이지

**Files:**
- Create: `src/components/attendance/attendance-table.tsx`, `src/components/attendance/attendance-filter.tsx`, `src/app/attendance/page.tsx`

- [ ] **Step 1: 필터 컴포넌트 작성**

Write `src/components/attendance/attendance-filter.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type FilterValues = {
  startDate: string
  endDate: string
  departmentId: string
  status: string
  shiftType: string
}

type Department = { id: string; name: string }

export function AttendanceFilter({
  onFilter,
}: {
  onFilter: (filters: FilterValues) => void
}) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [filters, setFilters] = useState<FilterValues>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    departmentId: '',
    status: '',
    shiftType: '',
  })

  useEffect(() => {
    fetch('/api/departments')
      .then((res) => res.json())
      .then(setDepartments)
  }, [])

  return (
    <div className="flex flex-wrap gap-3 items-end bg-white p-4 rounded-lg border">
      <div>
        <label className="text-sm text-slate-500 block mb-1">시작일</label>
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm text-slate-500 block mb-1">종료일</label>
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm text-slate-500 block mb-1">부서</label>
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={filters.departmentId}
          onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
        >
          <option value="">전체</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm text-slate-500 block mb-1">상태</label>
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">전체</option>
          <option value="NORMAL">정상</option>
          <option value="LATE">지각</option>
          <option value="ABSENT">결근</option>
          <option value="EARLY_LEAVE">조퇴</option>
        </select>
      </div>
      <div>
        <label className="text-sm text-slate-500 block mb-1">시차유형</label>
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={filters.shiftType}
          onChange={(e) => setFilters({ ...filters, shiftType: e.target.value })}
        >
          <option value="">전체</option>
          <option value="SHIFT_8">8시 출근</option>
          <option value="SHIFT_9">9시 출근</option>
          <option value="SHIFT_10">10시 출근</option>
        </select>
      </div>
      <Button onClick={() => onFilter(filters)}>조회</Button>
    </div>
  )
}
```

- [ ] **Step 2: 근태 테이블 컴포넌트 작성**

Write `src/components/attendance/attendance-table.tsx`:
```typescript
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type AttendanceRow = {
  id: string
  date: string
  employeeName: string
  employeeNumber: string
  department: string
  shiftType: string
  checkIn: string | null
  checkOut: string | null
  workHours: number | null
  overtime: number | null
  status: string
  isAnomaly: boolean
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NORMAL: { label: '정상', variant: 'default' },
  LATE: { label: '지각', variant: 'secondary' },
  ABSENT: { label: '결근', variant: 'destructive' },
  EARLY_LEAVE: { label: '조퇴', variant: 'outline' },
}

const shiftLabels: Record<string, string> = {
  SHIFT_8: '8시',
  SHIFT_9: '9시',
  SHIFT_10: '10시',
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export function AttendanceTable({ records }: { records: AttendanceRow[] }) {
  return (
    <div className="bg-white rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>날짜</TableHead>
            <TableHead>사번</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>시차</TableHead>
            <TableHead>출근</TableHead>
            <TableHead>퇴근</TableHead>
            <TableHead>근무시간</TableHead>
            <TableHead>초과근무</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => {
            const sc = statusConfig[r.status] || { label: r.status, variant: 'default' as const }
            return (
              <TableRow key={r.id} className={r.isAnomaly ? 'bg-red-50' : ''}>
                <TableCell>{new Date(r.date).toLocaleDateString('ko-KR')}</TableCell>
                <TableCell>{r.employeeNumber}</TableCell>
                <TableCell>{r.employeeName}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>{shiftLabels[r.shiftType] || r.shiftType}</TableCell>
                <TableCell>{formatTime(r.checkIn)}</TableCell>
                <TableCell>{formatTime(r.checkOut)}</TableCell>
                <TableCell>{r.workHours?.toFixed(1) ?? '-'}</TableCell>
                <TableCell>{r.overtime && r.overtime > 0 ? r.overtime.toFixed(1) : '-'}</TableCell>
                <TableCell>
                  <Badge variant={sc.variant}>{sc.label}</Badge>
                </TableCell>
              </TableRow>
            )
          })}
          {records.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-slate-400 py-8">
                조회 결과가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 3: 근태 조회 페이지 작성**

Write `src/app/attendance/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { AttendanceFilter } from '@/components/attendance/attendance-filter'
import { AttendanceTable } from '@/components/attendance/attendance-table'
import { Button } from '@/components/ui/button'

type AttendanceRecord = {
  id: string
  date: string
  employeeName: string
  employeeNumber: string
  department: string
  shiftType: string
  checkIn: string | null
  checkOut: string | null
  workHours: number | null
  overtime: number | null
  status: string
  isAnomaly: boolean
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentFilters, setCurrentFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const fetchData = (filters: Record<string, string>, page = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries({ ...filters, page: String(page) }).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })

    fetch(`/api/attendance?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setRecords(data.records)
        setPagination(data.pagination)
        setCurrentFilters(filters)
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">근태 조회</h1>
      <AttendanceFilter onFilter={(f) => fetchData(f)} />
      {loading ? (
        <div className="text-center py-10">로딩 중...</div>
      ) : (
        <>
          <AttendanceTable records={records} />
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchData(currentFilters, pagination.page - 1)}
              >
                이전
              </Button>
              <span className="flex items-center px-3 text-sm">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchData(currentFilters, pagination.page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/attendance/ src/app/attendance/
git commit -m "feat: add attendance query page with filter and paginated table"
```

---

## Task 13: 리포트 페이지

**Files:**
- Create: `src/app/reports/page.tsx`

- [ ] **Step 1: 리포트 페이지 작성**

Write `src/app/reports/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type DeptStat = {
  name: string
  total: number
  late: number
  absent: number
  lateRate: number
  avgWorkHours: number
}

type ReportData = {
  month: string
  totalRecords: number
  departmentStats: DeptStat[]
}

export default function ReportsPage() {
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = () => {
    setLoading(true)
    fetch(`/api/reports?month=${month}`)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  const downloadExcel = () => {
    window.open(`/api/reports/excel?month=${month}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">리포트</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="text-sm text-slate-500 block mb-1">월 선택</label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <Button onClick={fetchReport}>조회</Button>
        {data && (
          <Button variant="outline" onClick={downloadExcel}>
            엑셀 다운로드
          </Button>
        )}
      </div>

      {loading && <div className="text-center py-10">로딩 중...</div>}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{data.month} 월간 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">총 근태 기록: {data.totalRecords}건</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>부서별 지각률</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.departmentStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="lateRate" fill="#ED7D31" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>부서별 상세 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">부서</th>
                    <th className="text-right py-2">총 기록</th>
                    <th className="text-right py-2">지각</th>
                    <th className="text-right py-2">결근</th>
                    <th className="text-right py-2">지각률</th>
                    <th className="text-right py-2">평균 근무시간</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departmentStats.map((s) => (
                    <tr key={s.name} className="border-b">
                      <td className="py-2">{s.name}</td>
                      <td className="text-right">{s.total}</td>
                      <td className="text-right text-orange-500">{s.late}</td>
                      <td className="text-right text-red-500">{s.absent}</td>
                      <td className="text-right">{s.lateRate}%</td>
                      <td className="text-right">{s.avgWorkHours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/reports/
git commit -m "feat: add reports page with monthly stats and Excel download"
```

---

## Task 14: 관리자 설정 페이지

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: 설정 페이지 작성**

Write `src/app/settings/page.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Employee = {
  id: string
  employeeNumber: string
  name: string
  shiftType: string
  position: string | null
  department: { id: string; name: string }
}

type Department = {
  id: string
  name: string
  _count: { employees: number }
}

export default function SettingsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [syncStatus, setSyncStatus] = useState<string>('')

  useEffect(() => {
    fetch('/api/employees').then((r) => r.json()).then(setEmployees)
    fetch('/api/departments').then((r) => r.json()).then(setDepartments)
  }, [])

  const handleSync = async () => {
    setSyncStatus('동기화 중...')
    const res = await fetch('/api/sync', { method: 'POST' })
    const data = await res.json()
    setSyncStatus(data.success ? '동기화 완료!' : `오류: ${data.error}`)
  }

  const updateShift = async (empId: string, shiftType: string) => {
    await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: empId, shiftType }),
    })
    // 목록 새로고침
    const updated = await fetch('/api/employees').then((r) => r.json())
    setEmployees(updated)
  }

  const shiftLabels: Record<string, string> = {
    SHIFT_8: '8시',
    SHIFT_9: '9시',
    SHIFT_10: '10시',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* 동기화 */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 동기화</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={handleSync}>수동 동기화 실행</Button>
          {syncStatus && <span className="text-sm text-slate-500">{syncStatus}</span>}
        </CardContent>
      </Card>

      {/* 부서 현황 */}
      <Card>
        <CardHeader>
          <CardTitle>부서 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {departments.map((d) => (
              <div key={d.id} className="border rounded p-3">
                <div className="font-medium">{d.name}</div>
                <div className="text-sm text-slate-400">{d._count.employees}명</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 직원 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>직원 시차출퇴근 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">사번</th>
                <th className="text-left py-2">이름</th>
                <th className="text-left py-2">부서</th>
                <th className="text-left py-2">직급</th>
                <th className="text-left py-2">시차유형</th>
                <th className="text-left py-2">변경</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b">
                  <td className="py-2">{emp.employeeNumber}</td>
                  <td>{emp.name}</td>
                  <td>{emp.department.name}</td>
                  <td>{emp.position || '-'}</td>
                  <td>
                    <Badge variant="outline">{shiftLabels[emp.shiftType]}</Badge>
                  </td>
                  <td>
                    <select
                      className="text-sm border rounded px-2 py-1"
                      value={emp.shiftType}
                      onChange={(e) => updateShift(emp.id, e.target.value)}
                    >
                      <option value="SHIFT_8">8시 출근</option>
                      <option value="SHIFT_9">9시 출근</option>
                      <option value="SHIFT_10">10시 출근</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/
git commit -m "feat: add settings page with sync control and employee shift management"
```

---

## Task 15: 통합 테스트 & 검증

- [ ] **Step 1: seed 데이터 기반 동기화 실행**

```bash
npx prisma db seed
```

- [ ] **Step 2: 개발 서버 실행**

```bash
npm run dev
```

- [ ] **Step 3: 동기화 API 호출하여 집계 데이터 생성**

```bash
curl -X POST http://localhost:3000/api/sync
```

Expected: `{"success":true,"message":"Aggregation completed for ..."}`

- [ ] **Step 4: 브라우저에서 검증**

- `http://localhost:3000` → 대시보드: 통계 카드, 부서 차트, 시차 분포 확인
- `http://localhost:3000/attendance` → 근태 조회: 필터링, 페이지네이션 확인
- `http://localhost:3000/reports` → 리포트: 월간 통계, 엑셀 다운로드 확인
- `http://localhost:3000/settings` → 설정: 직원 목록, 시차 변경, 수동 동기화 확인

- [ ] **Step 5: 단위 테스트 실행**

```bash
npx vitest run
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete attendance management system v1.0"
```
