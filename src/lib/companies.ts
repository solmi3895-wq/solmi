// 이메일 도메인 → 법인 매핑
export const DOMAIN_COMPANY_MAP: Record<string, string> = {
  'petitelin.com': '쁘띠엘린',
  'essenlue.com': '에센루',
  'doodoostory.com': '두두스토리',
  'moyuum.com': '모윰',
  'elyssia.co.kr': '경영지원부문',
}

export const ALLOWED_DOMAINS = Object.keys(DOMAIN_COMPANY_MAP)

export function getCompanyByDomain(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? (DOMAIN_COMPANY_MAP[domain] ?? null) : null
}

export function isAllowedDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  return domain ? ALLOWED_DOMAINS.includes(domain) : false
}
