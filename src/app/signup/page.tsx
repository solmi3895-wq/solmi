'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ALLOWED_DOMAINS = [
  { domain: 'petitelin.com', company: '쁘띠엘린' },
  { domain: 'essenlue.com', company: '에센루' },
  { domain: 'doodoostory.com', company: '두두스토리' },
  { domain: 'moyuum.com', company: '모윰' },
  { domain: 'elyssia.co.kr', company: '경영지원부문' },
]

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const emailDomain = email.split('@')[1]?.toLowerCase() || ''
  const matchedCompany = ALLOWED_DOMAINS.find(d => d.domain === emailDomain)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (!matchedCompany) {
      setError('회사 이메일 주소를 사용해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border">
        <h1 className="text-2xl font-bold text-center mb-2">엘리시아 근태 관리 시스템</h1>
        <p className="text-center text-zinc-500 mb-8">회원가입</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="근태 기록과 동일한 이름"
              required
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-400 mt-1">근태 데이터에 등록된 이름과 동일하게 입력해주세요.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">회사 이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {emailDomain && (
              <p className={`text-xs mt-1 ${matchedCompany ? 'text-green-600' : 'text-red-500'}`}>
                {matchedCompany
                  ? `✓ ${matchedCompany.company} 소속으로 가입됩니다.`
                  : '✗ 허용되지 않은 도메인입니다. 회사 이메일을 사용해주세요.'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="8자 이상"
              required
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 재입력"
              required
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !matchedCompany}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-500">
            이미 계정이 있으신가요?{' '}
            <a href="/login" className="text-blue-600 hover:underline">로그인</a>
          </p>
        </div>
      </div>
    </div>
  )
}
