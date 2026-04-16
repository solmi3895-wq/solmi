'use client'

import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setSent(true) // 보안상 같은 화면 표시
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border">
        <h1 className="text-2xl font-bold text-center mb-2">비밀번호 찾기</h1>
        <p className="text-center text-zinc-500 mb-8">
          가입한 이메일 주소를 입력하시면<br />비밀번호 재설정 링크를 보내드립니다.
        </p>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 text-green-700 rounded-lg">
              등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다. 이메일을 확인해주세요.
            </div>
            <a href="/login" className="text-sm text-blue-600 hover:underline">
              로그인으로 돌아가기
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '발송 중...' : '재설정 링크 발송'}
            </button>

            <div className="text-center">
              <a href="/login" className="text-sm text-blue-600 hover:underline">
                로그인으로 돌아가기
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
