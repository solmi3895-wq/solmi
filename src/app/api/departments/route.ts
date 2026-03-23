import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { employees: { where: { isActive: true } } } },
        children: true,
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(departments)
  } catch (error) {
    console.error('Departments API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
