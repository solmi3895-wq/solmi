import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 최초 관리자 설정용 API (이미 관리자가 있으면 차단)
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 })
    }

    // 이미 관리자가 있는지 확인
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (existingAdmin) {
      return NextResponse.json({ error: '이미 관리자가 존재합니다.' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      return NextResponse.json({ error: '해당 이메일로 등록된 사용자가 없습니다. 먼저 회원가입하세요.' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })

    return NextResponse.json({ success: true, message: `${user.name}님이 관리자로 설정되었습니다.` })
  } catch (error) {
    console.error('Make admin error:', error)
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 })
  }
}
