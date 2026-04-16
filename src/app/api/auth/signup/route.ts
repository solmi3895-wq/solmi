import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createSession } from '@/lib/session'
import { getCompanyByDomain, isAllowedDomain } from '@/lib/companies'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
    }

    if (!isAllowedDomain(email)) {
      return NextResponse.json({ error: '허용되지 않은 이메일 도메인입니다. 회사 이메일을 사용해주세요.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 400 })
    }

    const companyName = getCompanyByDomain(email)!
    const passwordHash = await bcrypt.hash(password, 12)

    // 관리자 이메일 목록
    const ADMIN_EMAILS = ['sm.oh@elyssia.co.kr']
    const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'ADMIN' : 'USER'

    // Employee 자동 매칭: 이름 + 법인(부서)으로 찾기
    const matchedEmployee = await prisma.employee.findFirst({
      where: {
        name: name.trim(),
        department: { name: companyName },
      },
    })

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name.trim(),
        role,
        companyName,
        employeeId: matchedEmployee?.id || null,
      },
    })

    await createSession(user.id, user.role)

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: user.role, companyName: user.companyName },
      matched: !!matchedEmployee,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: '회원가입 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
