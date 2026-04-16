import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(request: NextRequest) {
  try {
    const { id, name, departmentName, shiftType } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (name) data.name = name
    if (shiftType) data.shiftType = shiftType
    if (departmentName) {
      const dept = await prisma.department.upsert({
        where: { name: departmentName },
        create: { name: departmentName },
        update: {},
      })
      data.departmentId = dept.id
    }

    const updated = await prisma.employee.update({
      where: { id },
      data,
      include: { department: true },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Employee PATCH error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = { isActive: true }
    if (departmentId) where.departmentId = departmentId
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeNumber: { contains: search } },
      ]
    }

    const employees = await prisma.employee.findMany({
      where,
      include: { department: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Employees API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
