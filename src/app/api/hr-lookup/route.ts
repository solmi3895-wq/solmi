import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-api'
import { searchEmployeeByName, isConfigured } from '@/lib/google-sheets'

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // ADMIN 권한 확인
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자만 접근할 수 있습니다' }, { status: 403 })
    }

    // Google Sheets 설정 확인
    if (!isConfigured()) {
      return NextResponse.json(
        { error: 'Google Sheets 연동이 설정되지 않았습니다. 환경변수를 확인하세요.' },
        { status: 503 }
      )
    }

    // 검색어 확인
    const name = request.nextUrl.searchParams.get('name')
    if (!name || !name.trim()) {
      return NextResponse.json({ error: '이름을 입력해주세요' }, { status: 400 })
    }

    // 검색 수행
    const { results, headers } = await searchEmployeeByName(name)

    return NextResponse.json({ results, headers, count: results.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (message === 'GOOGLE_SHEETS_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'Google Sheets 연동이 설정되지 않았습니다. 환경변수를 확인하세요.' },
        { status: 503 }
      )
    }

    if (message === 'GOOGLE_SHEETS_ACCESS_FAILED') {
      return NextResponse.json(
        { error: '스프레드시트에 접근할 수 없습니다. 서비스 계정 권한을 확인하세요.' },
        { status: 502 }
      )
    }

    console.error('HR lookup error:', error)
    return NextResponse.json({ error: '검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
