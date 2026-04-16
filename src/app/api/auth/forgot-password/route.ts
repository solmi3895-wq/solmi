import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // 보안: 이메일 존재 여부와 관계없이 같은 응답
    const successMsg = '등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다.'

    if (!email) {
      return NextResponse.json({ message: successMsg })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ message: successMsg })
    }

    // 토큰 생성 (1시간 유효)
    const token = crypto.randomUUID()
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    // Resend로 이메일 발송
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'noreply@resend.dev',
          to: user.email,
          subject: '[엘리시아 근태관리] 비밀번호 재설정',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2>비밀번호 재설정</h2>
              <p>${user.name}님, 비밀번호 재설정을 요청하셨습니다.</p>
              <p>아래 링크를 클릭하여 새 비밀번호를 설정해주세요:</p>
              <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">비밀번호 재설정</a>
              <p style="color:#666;font-size:14px;">이 링크는 1시간 후 만료됩니다.</p>
              <p style="color:#666;font-size:14px;">본인이 요청하지 않은 경우 이 이메일을 무시해주세요.</p>
            </div>
          `,
        })
      } catch (emailError) {
        console.error('Email send error:', emailError)
      }
    } else {
      // 개발 환경: 콘솔에 링크 출력
      console.log(`[비밀번호 재설정] ${user.email}: ${resetUrl}`)
    }

    return NextResponse.json({ message: successMsg })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ message: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
