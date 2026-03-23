'use client'

import { useEffect, useState } from 'react'

type DashboardData = {
  summary: { totalEmployees: number; checkedIn: number; late: number; absent: number }
  departmentStats: { name: string; total: number; present: number; rate: number }[]
  shiftDistribution: Record<string, number>
  anomalies: {
    id: string; employeeName: string; employeeNumber: string
    department: string; checkIn: string | null; checkOut: string | null; status: string
  }[]
}

type AttendanceRecord = {
  id: string; date: string; checkIn: string | null; checkOut: string | null
  workHours: number | null; overtime: number | null; status: string; isAnomaly: boolean
  employee: { name: string; employeeNumber: string; department: { name: string } }
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

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [filter, setFilter] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'records' | 'upload'>('dashboard')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number; total: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const fetchDashboard = () => fetch('/api/dashboard').then((r) => r.json()).then(setDashboard)
  const fetchRecords = () => {
    const params = filter ? `?status=${filter}` : ''
    fetch(`/api/attendance${params}`).then((r) => r.json()).then(setRecords)
  }

  useEffect(() => { fetchDashboard(); fetchRecords() }, [])
  useEffect(() => { fetchRecords() }, [filter])

  const handleSync = async () => {
    setSyncing(true)
    await fetch('/api/sync', { method: 'POST' })
    await Promise.all([fetchDashboard(), fetchRecords()])
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
    await Promise.all([fetchDashboard(), fetchRecords()])
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
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? '동기화 중...' : '출입 데이터 동기화'}
          </button>
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

        {tab === 'dashboard' && dashboard && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard label="전체 인원" value={dashboard.summary.totalEmployees} color="bg-white dark:bg-zinc-900" />
              <StatCard label="출근" value={dashboard.summary.checkedIn} color="bg-green-50 dark:bg-green-950" />
              <StatCard label="지각" value={dashboard.summary.late} color="bg-yellow-50 dark:bg-yellow-950" />
              <StatCard label="결근" value={dashboard.summary.absent} color="bg-red-50 dark:bg-red-950" />
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
                <h2 className="mb-3 font-semibold dark:text-white">부서별 출근율</h2>
                {dashboard.departmentStats.map((d) => (
                  <div key={d.name} className="mb-2">
                    <div className="flex justify-between text-sm dark:text-zinc-300">
                      <span>{d.name}</span>
                      <span>{d.present}/{d.total} ({d.rate}%)</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${d.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900">
                <h2 className="mb-3 font-semibold dark:text-white">근무 시간대 분포</h2>
                {Object.entries(dashboard.shiftDistribution).map(([shift, count]) => (
                  <div key={shift} className="mb-2 flex items-center justify-between text-sm dark:text-zinc-300">
                    <span>{shift === 'SHIFT_8' ? '8시 출근' : shift === 'SHIFT_9' ? '9시 출근' : '10시 출근'}</span>
                    <span className="font-medium">{count}명</span>
                  </div>
                ))}
              </div>
            </div>

            {dashboard.anomalies.length > 0 && (
              <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-900 dark:bg-orange-950">
                <h2 className="mb-3 font-semibold text-orange-800 dark:text-orange-200">이상 감지 ({dashboard.anomalies.length}건)</h2>
                <div className="space-y-2">
                  {dashboard.anomalies.map((a) => (
                    <div key={a.id} className="text-sm text-orange-700 dark:text-orange-300">
                      {a.employeeName} ({a.employeeNumber}) - {a.department} | 출근: {formatTime(a.checkIn)} / 퇴근: {formatTime(a.checkOut)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
            <div className="mb-4 flex gap-2">
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
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">데이터가 없습니다. 동기화를 실행해주세요.</td></tr>
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
