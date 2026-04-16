import { prisma } from './db'
import { decrypt } from './session'

export async function getAuthUser(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const sessionMatch = cookieHeader.match(/session=([^;]+)/)
  if (!sessionMatch) return null

  const payload = await decrypt(sessionMatch[1])
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { employee: true },
  })

  return user
}
