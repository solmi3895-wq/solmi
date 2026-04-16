'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type AuthUser = {
  id: string; email: string; name: string; role: string; companyName: string; employeeId: string | null
}

type DashboardData = {
  summary: { totalEmployees: number; checkedIn: number; late: number; absent: number }
}

type AttendanceRecord = {
  id: string; date: string; checkIn: string | null; checkOut: string | null
  workHours: number | null; overtime: number | null; status: string; isAnomaly: boolean
  employee: { id: string; name: string; employeeNumber: string; shiftType: string; department: { name: string } }
}

type CalendarDay = {
  date: string; normal: number; late: number; absent: number; total: number
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  )
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatStatus(status: string) {
  const map: Record<string, { label: string; color: string }> = {
    NORMAL: { label: '정상', color: 'bg-green-100 text-green-700' },
    LATE: { label: '지각', color: 'bg-yellow-100 text-yellow-700' },
    ABSENT: { label: '결근', color: 'bg-red-100 text-red-700' },
    ANNUAL_LEAVE: { label: '연차', color: 'bg-purple-100 text-purple-700' },
    AM_HALF: { label: '오전반차', color: 'bg-indigo-100 text-indigo-700' },
    PM_HALF: { label: '오후반차', color: 'bg-indigo-100 text-indigo-700' },
    EARLY_LEAVE: { label: '조퇴', color: 'bg-orange-100 text-orange-700' },
    DAY_ANNUAL_LEAVE: { label: '당일연차', color: 'bg-purple-100 text-purple-700' },
    DAY_AM_HALF: { label: '당일오전반차', color: 'bg-indigo-100 text-indigo-700' },
    DAY_AM_EARLY_LEAVE: { label: '당일오전조퇴', color: 'bg-orange-100 text-orange-700' },
    OUTSIDE_WORK: { label: '외근', color: 'bg-cyan-100 text-cyan-700' },
    OUTING: { label: '외출', color: 'bg-teal-100 text-teal-700' },
  }
  // 복합 상태 처리 (예: "AM_HALF,PM_HALF")
  if (status.includes(',')) {
    const parts = status.split(',')
    const labels = parts.map((s) => map[s]?.label || s).join(' + ')
    return { label: labels, color: 'bg-indigo-100 text-indigo-700' }
  }
  const info = map[status] || { label: status, color: 'bg-zinc-100 text-zinc-700' }
  return info
}

function formatShift(shiftType: string) {
  const map: Record<string, string> = { SHIFT_8: '8시', SHIFT_9: '9시', SHIFT_10: '10시' }
  return map[shiftType] || '8시'
}

const CORPORATIONS = ['쁘띠엘린', '에센루', '두두스토리', '모윰', '경영지원부문']
const SHIFTS = ['SHIFT_8', 'SHIFT_9', 'SHIFT_10']

// 2026년 대한민국 공휴일
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-05': '어린이날',
  '2026-05-24': '석가탄신일',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',
  // 대체공휴일
  '2026-10-05': '대체공휴일(개천절)',
}

function Calendar({
  year, month, days, selectedDate, onSelectDate, onDoubleClickDate, onChangeMonth,
}: {
  year: number; month: number; days: CalendarDay[]
  selectedDate: string; onSelectDate: (date: string) => void
  onDoubleClickDate?: (date: string) => void
  onChangeMonth: (year: number, month: number) => void
}) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const prevMonth = () => {
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    onChangeMonth(y, m)
  }
  const nextMonth = () => {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    onChangeMonth(y, m)
  }

  return (
    <div className="mx-auto max-w-3xl w-full rounded-xl border bg-white p-8 dark:bg-zinc-900 flex flex-col" style={{ height: '560px' }}>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg px-4 py-2 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300">&lt;</button>
        <h2 className="text-xl font-semibold dark:text-white">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="rounded-lg px-4 py-2 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300">&gt;</button>
      </div>
      <div className="grid grid-cols-7 text-center text-sm text-zinc-500">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="py-2 font-medium">{d}</div>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        {weeks.map((w, wi) => (
          <div key={wi} className="grid grid-cols-7 text-center flex-1">
            {w.map((d, di) => {
              if (d === null) return <div key={di} />
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === new Date().toISOString().split('T')[0]
              const holiday = HOLIDAYS_2026[dateStr]
              const isHoliday = !!holiday
              const hasData = days.some((day) => day.date === dateStr && day.total > 0)

              return (
                <button
                  key={di}
                  onClick={() => onSelectDate(dateStr)}
                  onDoubleClick={() => onDoubleClickDate?.(dateStr)}
                  title={holiday || (hasData ? '업로드 완료 (더블클릭: 근태기록 이동)' : undefined)}
                  className={`m-0.5 rounded-lg flex flex-col items-center justify-center text-base transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' :
                    isToday ? 'bg-blue-50 dark:bg-blue-950 font-bold' :
                    isHoliday ? 'bg-red-50 dark:bg-red-950 hover:bg-red-100' :
                    'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className={`font-medium ${(di === 0 || isHoliday) ? 'text-red-500' : di === 6 ? 'text-blue-500' : ''} ${isSelected ? 'text-white' : ''}`}>
                    {d}
                  </span>
                  {isHoliday && !isSelected && (
                    <span className="text-[9px] text-red-400 leading-tight">{holiday}</span>
                  )}
                  {hasData && !isHoliday && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [filter, setFilter] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'records' | 'myrecord' | 'upload' | 'hrlookup'>('myrecord')
  const isAdmin = user?.role === 'ADMIN'
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [downloadYear, setDownloadYear] = useState(new Date().getFullYear())
  const [downloadMonth, setDownloadMonth] = useState(new Date().getMonth() + 1)
  const [downloadCorp, setDownloadCorp] = useState(CORPORATIONS[0])
  const [downloading, setDownloading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [recordDate, setRecordDate] = useState<string>('')
  const [searchName, setSearchName] = useState<string>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCorp, setEditCorp] = useState('')
  const [editShift, setEditShift] = useState('')
  const [monthlySummary, setMonthlySummary] = useState<{
    employee: { name: string; department: string; shiftType: string } | null
    summary: { normal: number; late: number; absent: number; annualLeave?: number; halfDay?: number; earlyLeave?: number; total: number }
    days: { date: string; checkIn: string | null; status: string; workHours: number | null }[]
  } | null>(null)
  const [myName, setMyName] = useState('')
  const [myYear, setMyYear] = useState(new Date().getFullYear())
  const [myMonth, setMyMonth] = useState(new Date().getMonth() + 1)

  // 인사정보 조회 상태
  const [hrSearchQuery, setHrSearchQuery] = useState('')
  const [hrResults, setHrResults] = useState<Record<string, string>[]>([])
  const [hrLoading, setHrLoading] = useState(false)
  const [hrError, setHrError] = useState('')
  const [hrSelectedEmployee, setHrSelectedEmployee] = useState<Record<string, string> | null>(null)

  const fetchMonthly = (name: string, y?: number, m?: number) => {
    if (!name) { setMonthlySummary(null); return }
    const year = y ?? myYear
    const month = m ?? myMonth
    fetch(`/api/attendance/monthly?name=${encodeURIComponent(name)}&year=${year}&month=${month}`)
      .then((r) => r.json())
      .then(setMonthlySummary)
  }

  const startEdit = (emp: { id: string; name: string; shiftType: string; department: { name: string } }) => {
    setEditingId(emp.id)
    setEditName(emp.name)
    setEditCorp(emp.department.name)
    setEditShift(emp.shiftType)
  }

  const saveEdit = async (empId: string) => {
    await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: empId, name: editName, departmentName: editCorp, shiftType: editShift }),
    })
    setEditingId(null)
    fetchRecords(recordDate, searchName)
  }

  const fetchDashboard = (date?: string) => {
    const params = date ? `?date=${date}` : ''
    fetch(`/api/dashboard${params}`).then((r) => r.json()).then(setDashboard)
  }
  const fetchRecords = (date?: string, search?: string) => {
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)
    const d = date ?? recordDate ?? selectedDate
    if (d) params.set('date', d)
    const s = search ?? searchName
    if (s) params.set('search', s)
    const qs = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/attendance${qs}`).then((r) => r.json()).then(setRecords)
  }
  const fetchCalendar = (y: number, m: number) => {
    fetch(`/api/calendar?year=${y}&month=${m}`).then((r) => r.json()).then((d) => setCalendarDays(d.days || []))
  }

  // 인증 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => {
        setUser(data.user)
        setAuthLoading(false)
        // 일반 사용자: 내 근태 탭 + 자동 이름 설정
        if (data.user.role !== 'ADMIN') {
          setTab('myrecord')
          setMyName(data.user.name)
          // 자동 조회
          setTimeout(() => {
            fetch(`/api/attendance/monthly?name=${encodeURIComponent(data.user.name)}&year=${myYear}&month=${myMonth}`)
              .then(r => r.json())
              .then(setMonthlySummary)
          }, 100)
        } else {
          setTab('dashboard')
        }
      })
      .catch(() => { router.push('/login') })
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  useEffect(() => { if (user && isAdmin) { fetchDashboard(); fetchRecords(); fetchCalendar(calYear, calMonth) } }, [user])

  useEffect(() => { fetchRecords() }, [filter])

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    fetchDashboard(date)
    fetchRecords(date)
  }

  const handleDoubleClickDate = (date: string) => {
    setRecordDate(date)
    setTab('records')
    fetchRecords(date)
  }

  const handleChangeMonth = (y: number, m: number) => {
    setCalYear(y)
    setCalMonth(m)
    fetchCalendar(y, m)
  }

  const handleSync = async () => {
    setSyncing(true)
    await fetch('/api/sync', { method: 'POST' })
    await Promise.all([fetchDashboard(selectedDate), fetchRecords(selectedDate), fetchCalendar(calYear, calMonth)])
    setSyncing(false)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadResult(null)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const result = await res.json()
    setUploadResult(result)
    setUploading(false)
    await Promise.all([fetchDashboard(selectedDate), fetchRecords(selectedDate), fetchCalendar(calYear, calMonth)])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleUpload(file)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {authLoading && (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-zinc-400">로딩 중...</p>
        </div>
      )}
      {!authLoading && (
      <>
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold dark:text-white">엘리시아 근태 관리 시스템</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">
              {user?.name} ({user?.companyName})
              {isAdmin && <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">관리자</span>}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex gap-2">
          {(isAdmin
            ? (['myrecord', 'dashboard', 'records', 'upload', 'hrlookup'] as const)
            : (['myrecord'] as const)
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {t === 'dashboard' ? '대시보드' : t === 'myrecord' ? '내 근태' : t === 'records' ? '근태 기록' : t === 'upload' ? '엑셀 업로드' : '인사정보 조회'}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="space-y-6">
            <div>
              {selectedDate && (
                <p className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {selectedDate} 근태 현황
                </p>
              )}
              {dashboard ? (
                <div className="grid grid-cols-4 gap-3">
                  <StatCard label="전체 인원" value={dashboard.summary.totalEmployees} color="bg-white dark:bg-zinc-900" />
                  <StatCard label="출근" value={dashboard.summary.checkedIn} color="bg-green-50 dark:bg-green-950" />
                  <StatCard label="지각" value={dashboard.summary.late} color="bg-yellow-50 dark:bg-yellow-950" />
                  <StatCard label="결근" value={dashboard.summary.absent} color="bg-red-50 dark:bg-red-950" />
                </div>
              ) : (
                <p className="text-sm text-zinc-400">날짜를 선택하세요</p>
              )}
            </div>
            <Calendar
              year={calYear}
              month={calMonth}
              days={calendarDays}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onDoubleClickDate={isAdmin ? handleDoubleClickDate : undefined}
              onChangeMonth={handleChangeMonth}
            />
          </div>
        )}

        {tab === 'myrecord' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <>
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      placeholder="이름을 입력하세요"
                      value={myName}
                      onChange={(e) => setMyName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') fetchMonthly(myName) }}
                      className="w-full rounded-lg border bg-white pl-9 pr-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">&#128269;</span>
                  </div>
                  <button
                    onClick={() => fetchMonthly(myName)}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    조회
                  </button>
                </>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => {
                    const m = myMonth === 1 ? 12 : myMonth - 1
                    const y = myMonth === 1 ? myYear - 1 : myYear
                    setMyMonth(m); setMyYear(y)
                    if (myName) fetchMonthly(myName, y, m)
                  }}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300"
                >&lt;</button>
                <span className="px-3 py-2 text-sm font-medium dark:text-white">{myYear}년 {myMonth}월</span>
                <button
                  onClick={() => {
                    const m = myMonth === 12 ? 1 : myMonth + 1
                    const y = myMonth === 12 ? myYear + 1 : myYear
                    setMyMonth(m); setMyYear(y)
                    if (myName) fetchMonthly(myName, y, m)
                  }}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300"
                >&gt;</button>
              </div>
            </div>

            {monthlySummary && monthlySummary.employee && (
              <>
                <div className="rounded-xl border bg-white p-6 dark:bg-zinc-900">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-bold dark:text-white">{monthlySummary.employee.name}</span>
                      <span className="ml-3 text-sm text-zinc-500">{monthlySummary.employee.department} / {formatShift(monthlySummary.employee.shiftType)} 근무</span>
                    </div>
                    <span className="text-sm text-zinc-500">{myYear}년 {myMonth}월 요약</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="rounded-lg bg-zinc-50 p-4 text-center dark:bg-zinc-800">
                      <p className="text-xs text-zinc-500">총 기록</p>
                      <p className="text-2xl font-bold dark:text-white">{monthlySummary.summary.total}<span className="text-sm font-normal text-zinc-400">일</span></p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950">
                      <p className="text-xs text-green-600">정상 출근</p>
                      <p className="text-2xl font-bold text-green-700">{monthlySummary.summary.normal}<span className="text-sm font-normal text-green-400">일</span></p>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-4 text-center dark:bg-yellow-950">
                      <p className="text-xs text-yellow-600">지각</p>
                      <p className="text-2xl font-bold text-yellow-700">{monthlySummary.summary.late}<span className="text-sm font-normal text-yellow-400">회</span></p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-950">
                      <p className="text-xs text-red-600">결근</p>
                      <p className="text-2xl font-bold text-red-700">{monthlySummary.summary.absent}<span className="text-sm font-normal text-red-400">일</span></p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border bg-white dark:bg-zinc-900">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-zinc-50 dark:bg-zinc-800">
                      <tr className="text-left text-zinc-500">
                        <th className="px-4 py-3">날짜</th>
                        <th className="px-4 py-3">출근</th>
                        <th className="px-4 py-3">근무시간</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.days.map((d) => (
                        <tr key={d.date} className="border-b last:border-0 dark:text-zinc-300">
                          <td className="px-4 py-3">{new Date(d.date).getMonth() + 1}/{new Date(d.date).getDate()}({['일','월','화','수','목','금','토'][new Date(d.date).getDay()]})</td>
                          <td className="px-4 py-3">{d.checkIn ? formatTime(d.checkIn) : '-'}</td>
                          <td className="px-4 py-3">{d.workHours?.toFixed(1) ?? '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${formatStatus(d.status).color}`}>{formatStatus(d.status).label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {(d.status === 'LATE' || d.status === 'ABSENT' || d.status === 'EARLY_LEAVE') && (
                              <a
                                href="https://forms.gle/ikreWzxhJp7DpCue6"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                              >
                                수정 요청
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                      {monthlySummary.days.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400">해당 월에 기록이 없습니다.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!monthlySummary && (
              <div className="rounded-xl border bg-white p-12 text-center dark:bg-zinc-900">
                <p className="text-zinc-400">이름을 입력하고 조회 버튼을 누르세요.</p>
              </div>
            )}

            {monthlySummary && !monthlySummary.employee && (
              <div className="rounded-xl border bg-white p-12 text-center dark:bg-zinc-900">
                <p className="text-zinc-400">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'
            }`}
          >
            <div className="mb-4 text-4xl">📂</div>
            <p className="mb-2 text-lg font-semibold dark:text-white">
              {uploading ? '업로드 중...' : '엑셀 파일을 여기에 드래그하세요'}
            </p>
            <p className="mb-4 text-sm text-zinc-500">또는 아래 버튼으로 파일을 선택하세요 (.xlsx)</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              id="file-upload"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
              }}
            />
            <label
              htmlFor="file-upload"
              className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              파일 선택
            </label>

            {uploadResult && (
              <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
                업로드 완료: 총 {uploadResult.total}건 중 {uploadResult.imported}건 처리, {uploadResult.skipped}건 스킵
              </div>
            )}
          </div>

          {/* 근태현황 다운로드 */}
          <div className="mt-6 rounded-xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-700">
            <h3 className="mb-4 text-lg font-semibold dark:text-white">근태현황 다운로드</h3>
            <p className="mb-4 text-sm text-zinc-500">법인별 월간 근태현황 엑셀 파일을 다운로드합니다.</p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={downloadYear}
                onChange={(e) => setDownloadYear(parseInt(e.target.value))}
                className="rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <select
                value={downloadMonth}
                onChange={(e) => setDownloadMonth(parseInt(e.target.value))}
                className="rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <select
                value={downloadCorp}
                onChange={(e) => setDownloadCorp(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
              >
                {CORPORATIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  setDownloading(true)
                  try {
                    const res = await fetch(`/api/attendance/download?year=${downloadYear}&month=${downloadMonth}&corp=${encodeURIComponent(downloadCorp)}`)
                    if (!res.ok) {
                      const err = await res.json()
                      alert(err.error || '다운로드 실패')
                      return
                    }
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${downloadYear}년_${String(downloadMonth).padStart(2, '0')}월 ${downloadCorp} 근태현황.xlsx`
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch {
                    alert('다운로드 중 오류가 발생했습니다.')
                  } finally {
                    setDownloading(false)
                  }
                }}
                disabled={downloading}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {downloading ? '다운로드 중...' : '다운로드'}
              </button>
              <button
                onClick={async () => {
                  setDownloading(true)
                  try {
                    for (const c of CORPORATIONS) {
                      const res = await fetch(`/api/attendance/download?year=${downloadYear}&month=${downloadMonth}&corp=${encodeURIComponent(c)}`)
                      if (!res.ok) continue
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${downloadYear}년_${String(downloadMonth).padStart(2, '0')}월 ${c} 근태현황.xlsx`
                      a.click()
                      URL.revokeObjectURL(url)
                      await new Promise(r => setTimeout(r, 500))
                    }
                  } catch {
                    alert('다운로드 중 오류가 발생했습니다.')
                  } finally {
                    setDownloading(false)
                  }
                }}
                disabled={downloading}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {downloading ? '다운로드 중...' : '전체 법인 다운로드'}
              </button>
            </div>
          </div>
          </>
        )}

        {tab === 'records' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const d = recordDate ? new Date(recordDate) : new Date()
                    d.setDate(d.getDate() - 1)
                    const newDate = d.toISOString().split('T')[0]
                    setRecordDate(newDate)
                    fetchRecords(newDate, searchName)
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300"
                >&lt;</button>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => {
                    setRecordDate(e.target.value)
                    fetchRecords(e.target.value, searchName)
                  }}
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                />
                <button
                  onClick={() => {
                    const d = recordDate ? new Date(recordDate) : new Date()
                    d.setDate(d.getDate() + 1)
                    const newDate = d.toISOString().split('T')[0]
                    setRecordDate(newDate)
                    fetchRecords(newDate, searchName)
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300"
                >&gt;</button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="이름 검색"
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value)
                    fetchRecords(recordDate, e.target.value)
                  }}
                  className="rounded-lg border bg-white pl-8 pr-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">&#128269;</span>
              </div>
              <div className="flex gap-2">
                {['', 'NORMAL', 'LATE', 'ABSENT'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      filter === s ? 'bg-blue-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                  >
                    {s === '' ? '전체' : s === 'NORMAL' ? '정상' : s === 'LATE' ? '지각' : '결근'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                {recordDate && (
                  <button
                    onClick={async () => {
                      if (!confirm(`${recordDate} 의 모든 근태 기록을 삭제하시겠습니까?`)) return
                      const res = await fetch(`/api/attendance/delete?date=${recordDate}`, { method: 'DELETE' })
                      const data = await res.json()
                      if (res.ok) {
                        alert(`${data.deleted}건 삭제 완료`)
                        fetchRecords(recordDate, searchName)
                        fetchDashboard(selectedDate)
                        fetchCalendar(calYear, calMonth)
                      } else {
                        alert(data.error)
                      }
                    }}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                  >
                    해당일 삭제
                  </button>
                )}
                <button
                  onClick={async () => {
                    const rd = recordDate ? new Date(recordDate) : new Date()
                    const y = rd.getFullYear()
                    const m = rd.getMonth() + 1
                    if (!confirm(`${y}년 ${m}월의 모든 근태 기록을 삭제하시겠습니까?`)) return
                    const res = await fetch(`/api/attendance/delete?mode=month&year=${y}&month=${m}`, { method: 'DELETE' })
                    const data = await res.json()
                    if (res.ok) {
                      alert(`${data.deleted}건 삭제 완료`)
                      fetchRecords(recordDate, searchName)
                      fetchDashboard(selectedDate)
                      fetchCalendar(calYear, calMonth)
                    } else {
                      alert(data.error)
                    }
                  }}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
                >
                  해당 월 삭제
                </button>
                <button
                  onClick={async () => {
                    if (!confirm('⚠️ 시스템의 모든 근태 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return
                    const res = await fetch('/api/attendance/delete?mode=all', { method: 'DELETE' })
                    const data = await res.json()
                    if (res.ok) {
                      alert(`${data.deleted}건 삭제 완료`)
                      fetchRecords(recordDate, searchName)
                      fetchDashboard(selectedDate)
                      fetchCalendar(calYear, calMonth)
                    } else {
                      alert(data.error)
                    }
                  }}
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
                >
                  모든 기록 삭제
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-white dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 dark:bg-zinc-800">
                  <tr className="text-left text-zinc-500">
                    <th className="px-4 py-3">법인</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">근무조</th>
                    <th className="px-4 py-3">출근</th>
                    <th className="px-4 py-3">퇴근</th>
                    <th className="px-4 py-3">근무시간</th>
                    <th className="px-4 py-3">초과근무</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const isEditing = editingId === r.employee.id
                    return (
                      <tr key={r.id} className="border-b last:border-0 dark:text-zinc-300">
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <select value={editCorp} onChange={(e) => setEditCorp(e.target.value)}
                              className="rounded border px-2 py-1 text-sm bg-white dark:bg-zinc-800">
                              {CORPORATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : r.employee.department.name}
                        </td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                              className="rounded border px-2 py-1 text-sm w-20 dark:bg-zinc-800" />
                          ) : r.employee.name}
                        </td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <select value={editShift} onChange={(e) => setEditShift(e.target.value)}
                              className="rounded border px-2 py-1 text-sm bg-white dark:bg-zinc-800">
                              {SHIFTS.map((s) => <option key={s} value={s}>{formatShift(s)}</option>)}
                            </select>
                          ) : formatShift(r.employee.shiftType)}
                        </td>
                        <td className="px-4 py-3">{formatTime(r.checkIn)}</td>
                        <td className="px-4 py-3">{formatTime(r.checkOut)}</td>
                        <td className="px-4 py-3">{r.workHours?.toFixed(1) ?? '-'}</td>
                        <td className="px-4 py-3">{r.overtime?.toFixed(1) ?? '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${formatStatus(r.status).color}`}>{formatStatus(r.status).label}</span>
                        </td>
                        <td className="px-4 py-2">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button onClick={() => saveEdit(r.employee.id)}
                                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">저장</button>
                              <button onClick={() => setEditingId(null)}
                                className="rounded bg-zinc-200 px-2 py-1 text-xs hover:bg-zinc-300 dark:bg-zinc-700">취소</button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(r.employee)}
                              className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400">수정</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {records.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-zinc-400">데이터가 없습니다. 날짜를 선택하거나 엑셀을 업로드하세요.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'hrlookup' && (
          <div className="space-y-6">
            {/* 검색 바 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={hrSearchQuery}
                onChange={(e) => setHrSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const query = hrSearchQuery.trim()
                    if (!query) return
                    setHrLoading(true)
                    setHrError('')
                    setHrSelectedEmployee(null)
                    fetch(`/api/hr-lookup?name=${encodeURIComponent(query)}`)
                      .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
                      .then(({ ok, data }) => {
                        if (!ok) { setHrError(data.error || '검색 실패'); setHrResults([]); return }
                        setHrResults(data.results || [])
                        if (data.results?.length === 1) setHrSelectedEmployee(data.results[0])
                        if (data.results?.length === 0) setHrError('검색 결과가 없습니다')
                      })
                      .catch(() => { setHrError('네트워크 오류가 발생했습니다'); setHrResults([]) })
                      .finally(() => setHrLoading(false))
                  }
                }}
                placeholder="이름을 입력하세요"
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              />
              <button
                onClick={() => {
                  const query = hrSearchQuery.trim()
                  if (!query) return
                  setHrLoading(true)
                  setHrError('')
                  setHrSelectedEmployee(null)
                  fetch(`/api/hr-lookup?name=${encodeURIComponent(query)}`)
                    .then((r) => r.json().then((d) => ({ ok: r.ok, data: d })))
                    .then(({ ok, data }) => {
                      if (!ok) { setHrError(data.error || '검색 실패'); setHrResults([]); return }
                      setHrResults(data.results || [])
                      if (data.results?.length === 1) setHrSelectedEmployee(data.results[0])
                      if (data.results?.length === 0) setHrError('검색 결과가 없습니다')
                    })
                    .catch(() => { setHrError('네트워크 오류가 발생했습니다'); setHrResults([]) })
                    .finally(() => setHrLoading(false))
                }}
                disabled={hrLoading || !hrSearchQuery.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                {hrLoading ? '검색 중...' : '검색'}
              </button>
            </div>

            {/* 에러 메시지 */}
            {hrError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {hrError}
              </div>
            )}

            {/* 검색 결과 목록 (2명 이상) */}
            {hrResults.length > 1 && !hrSelectedEmployee && (
              <div>
                <p className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  검색 결과 {hrResults.length}건
                </p>
                <div className="grid gap-2">
                  {hrResults.map((emp, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHrSelectedEmployee(emp)}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-blue-600 dark:hover:bg-zinc-700"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-white">{emp['성명']}</span>
                        <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                          {emp['법인']} / {emp['팀'] || emp['사업부'] || '-'} / {emp['직급'] || '-'}
                        </span>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        emp['근무상태'] === '재직' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : emp['근무상태'] === '퇴사' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                      }`}>
                        {emp['근무상태'] || '-'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 상세 정보 카드 */}
            {hrSelectedEmployee && (
              <div>
                {/* 뒤로가기 (목록이 여러 개였을 때만) */}
                {hrResults.length > 1 && (
                  <button
                    onClick={() => setHrSelectedEmployee(null)}
                    className="mb-4 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    <span>←</span> 목록으로 돌아가기
                  </button>
                )}

                {/* 이름 헤더 */}
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                    {hrSelectedEmployee['성명']?.[0] || '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{hrSelectedEmployee['성명']}</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {hrSelectedEmployee['법인']} · {hrSelectedEmployee['직급']} · {hrSelectedEmployee['사원ID']}
                    </p>
                  </div>
                  <span className={`ml-auto rounded-full px-3 py-1 text-sm font-medium ${
                    hrSelectedEmployee['근무상태'] === '재직' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      : hrSelectedEmployee['근무상태'] === '퇴사' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      : hrSelectedEmployee['근무상태'] === '휴직' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}>
                    {hrSelectedEmployee['근무상태'] || '-'}
                  </span>
                </div>

                {/* 섹션 카드들 */}
                <div className="grid gap-4">
                  {/* 기본정보 */}
                  {(() => {
                    const fields = [
                      { label: '사원ID', key: '사원ID' }, { label: '성명', key: '성명' },
                      { label: '법인', key: '법인' }, { label: '사업부', key: '사업부' },
                      { label: '팀', key: '팀' }, { label: '파트', key: '파트' },
                      { label: '직급', key: '직급' }, { label: '직책', key: '직책' },
                    ]
                    const hasData = fields.some(f => hrSelectedEmployee[f.key])
                    if (!hasData) return null
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-xs dark:bg-blue-900">👤</span>
                          기본정보
                        </h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                          {fields.map(f => hrSelectedEmployee[f.key] ? (
                            <div key={f.key}>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</p>
                              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{hrSelectedEmployee[f.key]}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 근무정보 */}
                  {(() => {
                    const fields = [
                      { label: '근무상태', key: '근무상태' }, { label: '근무조', key: '근무조' },
                      { label: '고용형태', key: '고용형태' }, { label: '입사일', key: '입사일' },
                      { label: '근무기간', key: '근무기간' },
                    ]
                    const hasData = fields.some(f => hrSelectedEmployee[f.key])
                    if (!hasData) return null
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-green-100 text-xs dark:bg-green-900">💼</span>
                          근무정보
                        </h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                          {fields.map(f => hrSelectedEmployee[f.key] ? (
                            <div key={f.key}>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</p>
                              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{hrSelectedEmployee[f.key]}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 휴직/퇴사 */}
                  {(() => {
                    const fields = [
                      { label: '휴직시작', key: '휴직시작' }, { label: '퇴사예정', key: '퇴사예정' },
                      { label: '실제퇴사일', key: '실제퇴사일' }, { label: '추정퇴사일', key: '추정퇴사일' },
                      { label: '퇴사사유', key: '퇴사사유' },
                    ]
                    const hasData = fields.some(f => hrSelectedEmployee[f.key])
                    if (!hasData) return null
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 text-xs dark:bg-orange-900">📋</span>
                          휴직/퇴사
                        </h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                          {fields.map(f => hrSelectedEmployee[f.key] ? (
                            <div key={f.key}>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</p>
                              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{hrSelectedEmployee[f.key]}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 개인정보 */}
                  {(() => {
                    const fields = [
                      { label: '성별', key: '성별' }, { label: '생년월일', key: '생년월일' },
                      { label: '나이', key: '나이' }, { label: '결혼유무', key: '결혼유무' },
                    ]
                    const hasData = fields.some(f => hrSelectedEmployee[f.key])
                    if (!hasData) return null
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-100 text-xs dark:bg-purple-900">🔒</span>
                          개인정보
                        </h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                          {fields.map(f => hrSelectedEmployee[f.key] ? (
                            <div key={f.key}>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</p>
                              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{hrSelectedEmployee[f.key]}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 연락처 */}
                  {(() => {
                    const fields = [
                      { label: '이메일', key: '이메일' }, { label: '내선번호', key: '내선번호' },
                      { label: '휴대번호', key: '휴대번호' },
                    ]
                    const hasData = fields.some(f => hrSelectedEmployee[f.key])
                    if (!hasData) return null
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100 text-xs dark:bg-cyan-900">📞</span>
                          연락처
                        </h3>
                        <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
                          {fields.map(f => hrSelectedEmployee[f.key] ? (
                            <div key={f.key}>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</p>
                              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{hrSelectedEmployee[f.key]}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 기타 */}
                  {(() => {
                    const fields = [
                      { label: '입사년월', key: '입사년월' }, { label: '입사년도', key: '입사년도' },
                      { label: '퇴사년월', key: '퇴사년월' }, { label: '퇴사년도', key: '퇴사년도' },
                      { label: '외국어능력', key: '외국어능력' }, { label: '주민등록번호', key: '주민등록번호' },
                    ]
                    const hasData = fields.some(f => hrSelectedEmployee[f.key])
                    if (!hasData) return null
                    return (
                      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800">
                        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-xs dark:bg-zinc-700">📄</span>
                          기타
                        </h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                          {fields.map(f => hrSelectedEmployee[f.key] ? (
                            <div key={f.key}>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{f.label}</p>
                              <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-white">{hrSelectedEmployee[f.key]}</p>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* 초기 안내 */}
            {!hrLoading && hrResults.length === 0 && !hrError && (
              <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl dark:bg-blue-950">🔍</div>
                <p className="text-lg font-medium text-zinc-700 dark:text-zinc-300">직원 이름을 입력하여 인사정보를 조회하세요</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Google Sheets의 Master Sheet 2.0에서 데이터를 가져옵니다</p>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
