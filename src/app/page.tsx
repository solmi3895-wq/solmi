'use client'

import { useEffect, useState } from 'react'

type DashboardData = {
  summary: { totalEmployees: number; checkedIn: number; late: number; absent: number }
}

type AttendanceRecord = {
  id: string; date: string; checkIn: string | null; checkOut: string | null
  workHours: number | null; overtime: number | null; status: string; isAnomaly: boolean
  employee: { name: string; employeeNumber: string; department: { name: string } }
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

function Calendar({
  year, month, days, selectedDate, onSelectDate, onChangeMonth,
}: {
  year: number; month: number; days: CalendarDay[]
  selectedDate: string; onSelectDate: (date: string) => void
  onChangeMonth: (year: number, month: number) => void
}) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayMap = new Map(days.map((d) => [d.date, d]))
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
    <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="rounded-lg px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300">&lt;</button>
        <h2 className="font-semibold dark:text-white">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="rounded-lg px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:text-zinc-300">&gt;</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-zinc-500 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="py-1 font-medium">{d}</div>
        ))}
      </div>
      {weeks.map((w, wi) => (
        <div key={wi} className="grid grid-cols-7 text-center">
          {w.map((d, di) => {
            if (d === null) return <div key={di} className="p-1" />
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const info = dayMap.get(dateStr)
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            const hasData = !!info

            return (
              <button
                key={di}
                onClick={() => onSelectDate(dateStr)}
                className={`m-0.5 rounded-lg p-1 text-xs transition-colors ${
                  isSelected ? 'bg-blue-600 text-white' :
                  isToday ? 'bg-blue-50 dark:bg-blue-950 font-bold' :
                  hasData ? 'hover:bg-zinc-100 dark:hover:bg-zinc-800' :
                  'text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className={`font-medium ${di === 0 ? 'text-red-500' : di === 6 ? 'text-blue-500' : ''} ${isSelected ? 'text-white' : ''}`}>
                  {d}
                </div>
                {hasData && (
                  <div className="mt-0.5 flex justify-center gap-0.5">
                    {info.normal > 0 && <span className={`inline-block h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />}
                    {info.late > 0 && <span className={`inline-block h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-yellow-500'}`} />}
                    {info.absent > 0 && <span className={`inline-block h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`} />}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> 출근</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-500" /> 지각</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> 결근</span>
      </div>
    </div>
  )
}

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [filter, setFilter] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'records' | 'upload'>('dashboard')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])

  const fetchDashboard = (date?: string) => {
    const params = date ? `?date=${date}` : ''
    fetch(`/api/dashboard${params}`).then((r) => r.json()).then(setDashboard)
  }
  const fetchRecords = (date?: string) => {
    const params = new URLSearchParams()
    if (filter) params.set('status', filter)
    if (date || selectedDate) params.set('date', date || selectedDate)
    const qs = params.toString() ? `?${params.toString()}` : ''
    fetch(`/api/attendance${qs}`).then((r) => r.json()).then(setRecords)
  }
  const fetchCalendar = (y: number, m: number) => {
    fetch(`/api/calendar?year=${y}&month=${m}`).then((r) => r.json()).then((d) => setCalendarDays(d.days || []))
  }

  useEffect(() => { fetchDashboard(); fetchRecords(); fetchCalendar(calYear, calMonth) }, [])

  useEffect(() => { fetchRecords() }, [filter])

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    fetchDashboard(date)
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
      <header className="border-b bg-white px-6 py-4 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-xl font-bold dark:text-white">근태 관리 시스템</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {syncing ? '동기화 중...' : '출입 데이터 동기화'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex gap-2">
          {(['dashboard', 'records', 'upload'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {t === 'dashboard' ? '대시보드' : t === 'records' ? '근태 기록' : '엑셀 업로드'}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (
          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <Calendar
              year={calYear}
              month={calMonth}
              days={calendarDays}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onChangeMonth={handleChangeMonth}
            />
            <div>
              {selectedDate && (
                <p className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {selectedDate} 근태 현황
                </p>
              )}
              {dashboard ? (
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="전체 인원" value={dashboard.summary.totalEmployees} color="bg-white dark:bg-zinc-900" />
                  <StatCard label="출근" value={dashboard.summary.checkedIn} color="bg-green-50 dark:bg-green-950" />
                  <StatCard label="지각" value={dashboard.summary.late} color="bg-yellow-50 dark:bg-yellow-950" />
                  <StatCard label="결근" value={dashboard.summary.absent} color="bg-red-50 dark:bg-red-950" />
                </div>
              ) : (
                <p className="text-sm text-zinc-400">날짜를 선택하세요</p>
              )}
            </div>
          </div>
        )}

        {tab === 'upload' && (
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
        )}

        {tab === 'records' && (
          <>
            <div className="mb-4 flex items-center gap-4">
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
              {selectedDate && (
                <span className="text-sm text-zinc-500">{selectedDate}</span>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border bg-white dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="border-b bg-zinc-50 dark:bg-zinc-800">
                  <tr className="text-left text-zinc-500">
                    <th className="px-4 py-3">사번</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">부서</th>
                    <th className="px-4 py-3">출근</th>
                    <th className="px-4 py-3">퇴근</th>
                    <th className="px-4 py-3">근무시간</th>
                    <th className="px-4 py-3">초과근무</th>
                    <th className="px-4 py-3">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 dark:text-zinc-300">
                      <td className="px-4 py-3">{r.employee.employeeNumber}</td>
                      <td className="px-4 py-3">{r.employee.name}</td>
                      <td className="px-4 py-3">{r.employee.department.name}</td>
                      <td className="px-4 py-3">{formatTime(r.checkIn)}</td>
                      <td className="px-4 py-3">{formatTime(r.checkOut)}</td>
                      <td className="px-4 py-3">{r.workHours?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3">{r.overtime?.toFixed(1) ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === 'NORMAL' ? 'bg-green-100 text-green-700' :
                          r.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>{r.status === 'NORMAL' ? '정상' : r.status === 'LATE' ? '지각' : '결근'}</span>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">데이터가 없습니다. 날짜를 선택하거나 엑셀을 업로드하세요.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
