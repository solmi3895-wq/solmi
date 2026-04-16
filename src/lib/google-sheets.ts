import { google } from 'googleapis'

// 데이터 섹션 구성
export const HR_SECTIONS = [
  {
    title: '기본정보',
    fields: ['사원ID', '성명', '법인', '사업부', '팀', '파트', '직급', '직책'],
  },
  {
    title: '근무정보',
    fields: ['근무상태', '근무조', '고용형태', '입사일', '근무기간'],
  },
  {
    title: '휴직/퇴사',
    fields: ['휴직시작', '퇴사예정', '실제퇴사일', '추정퇴사일', '퇴사사유'],
  },
  {
    title: '개인정보',
    fields: ['성별', '생년월일', '나이', '결혼유무'],
  },
  {
    title: '연락처',
    fields: ['이메일', '내선번호', '휴대번호'],
  },
  {
    title: '기타',
    fields: ['입사년월', '입사년도', '퇴사년월', '퇴사년도', '외국어능력', '주민등록번호'],
  },
] as const

// 민감정보 마스킹
function maskSensitiveFields(row: Record<string, string>): Record<string, string> {
  const masked = { ...row }

  // 주민등록번호: 앞 6자리만 표시
  if (masked['주민등록번호']) {
    const val = masked['주민등록번호'].replace(/[^0-9-]/g, '')
    if (val.length >= 6) {
      masked['주민등록번호'] = val.substring(0, 6) + '-*******'
    }
  }

  // 휴대번호: 가운데 마스킹
  if (masked['휴대번호']) {
    const val = masked['휴대번호'].replace(/[^0-9-]/g, '')
    const digits = val.replace(/-/g, '')
    if (digits.length >= 10) {
      masked['휴대번호'] = digits.substring(0, 3) + '-****-' + digits.substring(digits.length - 4)
    }
  }

  return masked
}

// 인메모리 캐시 (5분 TTL)
let cache: { data: Record<string, string>[]; headers: string[]; fetchedAt: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    return null
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

async function fetchSheetData(): Promise<{ data: Record<string, string>[]; headers: string[] }> {
  // 캐시 유효 시 반환
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return { data: cache.data, headers: cache.headers }
  }

  const auth = getAuthClient()
  if (!auth) {
    throw new Error('GOOGLE_SHEETS_NOT_CONFIGURED')
  }

  const sheets = google.sheets({ version: 'v4', auth })
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  const sheetName = process.env.GOOGLE_SHEET_NAME || 'Master Sheet 2.0'

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_NOT_CONFIGURED')
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'`,
    })

    const rows = response.data.values
    if (!rows || rows.length < 2) {
      cache = { data: [], headers: [], fetchedAt: Date.now() }
      return { data: [], headers: [] }
    }

    const headers = rows[0] as string[]

    // 빈 컬럼 필터링: 헤더가 비어있거나 모든 데이터가 비어있는 컬럼 제외
    const validIndices = headers.reduce<number[]>((acc, header, idx) => {
      if (!header || !header.trim()) return acc
      // 데이터 행 중 하나라도 값이 있으면 유효
      const hasData = rows.slice(1).some((row) => row[idx] && String(row[idx]).trim())
      if (hasData) acc.push(idx)
      return acc
    }, [])

    const filteredHeaders = validIndices.map((i) => headers[i])
    const data = rows.slice(1).map((row) => {
      const obj: Record<string, string> = {}
      for (const idx of validIndices) {
        obj[headers[idx]] = row[idx] ? String(row[idx]).trim() : ''
      }
      return obj
    })

    cache = { data, headers: filteredHeaders, fetchedAt: Date.now() }
    return { data, headers: filteredHeaders }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'GOOGLE_SHEETS_NOT_CONFIGURED') throw err
    throw new Error('GOOGLE_SHEETS_ACCESS_FAILED')
  }
}

export async function searchEmployeeByName(query: string): Promise<{
  results: Record<string, string>[]
  headers: string[]
}> {
  const { data, headers } = await fetchSheetData()
  const trimmedQuery = query.trim()

  if (!trimmedQuery) {
    return { results: [], headers }
  }

  const results = data
    .filter((row) => row['성명']?.includes(trimmedQuery))
    .map((row) => maskSensitiveFields(row))

  return { results, headers }
}

export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SPREADSHEET_ID)
}
