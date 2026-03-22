import { describe, it, expect } from 'vitest'
import {
  getShiftStartTime,
  determineCheckInOut,
  calculateWorkHours,
  determineStatus,
  calculateOvertime,
} from '../../src/lib/attendance'

describe('getShiftStartTime', () => {
  it('returns 8 for SHIFT_8', () => {
    expect(getShiftStartTime('SHIFT_8')).toBe(8)
  })

  it('returns 9 for SHIFT_9', () => {
    expect(getShiftStartTime('SHIFT_9')).toBe(9)
  })

  it('returns 10 for SHIFT_10', () => {
    expect(getShiftStartTime('SHIFT_10')).toBe(10)
  })

  it('returns 9 as default for unknown shift', () => {
    expect(getShiftStartTime('UNKNOWN')).toBe(9)
  })
})

describe('determineCheckInOut', () => {
  it('returns null values for empty logs', () => {
    const result = determineCheckInOut([])
    expect(result.checkIn).toBeNull()
    expect(result.checkOut).toBeNull()
    expect(result.isAnomaly).toBe(false)
  })

  it('picks earliest IN and latest OUT', () => {
    const logs = [
      { direction: 'IN', accessTime: new Date('2024-01-01T09:10:00') },
      { direction: 'IN', accessTime: new Date('2024-01-01T08:55:00') },
      { direction: 'OUT', accessTime: new Date('2024-01-01T18:00:00') },
      { direction: 'OUT', accessTime: new Date('2024-01-01T18:30:00') },
    ]
    const result = determineCheckInOut(logs)
    expect(result.checkIn).toEqual(new Date('2024-01-01T08:55:00'))
    expect(result.checkOut).toEqual(new Date('2024-01-01T18:30:00'))
    expect(result.isAnomaly).toBe(false)
  })

  it('marks anomaly when only IN logs exist', () => {
    const logs = [
      { direction: 'IN', accessTime: new Date('2024-01-01T09:00:00') },
    ]
    const result = determineCheckInOut(logs)
    expect(result.checkIn).not.toBeNull()
    expect(result.checkOut).toBeNull()
    expect(result.isAnomaly).toBe(true)
  })

  it('marks anomaly when only OUT logs exist', () => {
    const logs = [
      { direction: 'OUT', accessTime: new Date('2024-01-01T18:00:00') },
    ]
    const result = determineCheckInOut(logs)
    expect(result.checkIn).toBeNull()
    expect(result.checkOut).not.toBeNull()
    expect(result.isAnomaly).toBe(true)
  })
})

describe('calculateWorkHours', () => {
  it('returns null if checkOut is null', () => {
    const checkIn = new Date('2024-01-01T09:00:00')
    expect(calculateWorkHours(checkIn, null)).toBeNull()
  })

  it('calculates work hours minus lunch break', () => {
    const checkIn = new Date('2024-01-01T09:00:00')
    const checkOut = new Date('2024-01-01T18:00:00')
    // 9 hours - 1 hour lunch = 8 hours
    expect(calculateWorkHours(checkIn, checkOut)).toBe(8)
  })

  it('uses custom lunch break hours', () => {
    const checkIn = new Date('2024-01-01T09:00:00')
    const checkOut = new Date('2024-01-01T18:00:00')
    // 9 hours - 0.5 hours lunch = 8.5 hours
    expect(calculateWorkHours(checkIn, checkOut, 0.5)).toBe(8.5)
  })

  it('returns 0 if work hours would be negative', () => {
    const checkIn = new Date('2024-01-01T09:00:00')
    const checkOut = new Date('2024-01-01T09:30:00')
    // 0.5 hours - 1 hour lunch = negative => 0
    expect(calculateWorkHours(checkIn, checkOut)).toBe(0)
  })
})

describe('determineStatus', () => {
  it('returns ABSENT when checkIn is null', () => {
    expect(determineStatus(null, 'SHIFT_9', 10)).toBe('ABSENT')
  })

  it('returns NORMAL when checked in within grace period', () => {
    // SHIFT_9 = 9:00, grace = 10 min => allowed until 9:10
    const checkIn = new Date('2024-01-01T09:05:00')
    expect(determineStatus(checkIn, 'SHIFT_9', 10)).toBe('NORMAL')
  })

  it('returns NORMAL when checked in exactly at grace period limit', () => {
    const checkIn = new Date('2024-01-01T09:10:00')
    expect(determineStatus(checkIn, 'SHIFT_9', 10)).toBe('NORMAL')
  })

  it('returns LATE when checked in after grace period', () => {
    const checkIn = new Date('2024-01-01T09:11:00')
    expect(determineStatus(checkIn, 'SHIFT_9', 10)).toBe('LATE')
  })

  it('works for SHIFT_8', () => {
    const checkIn = new Date('2024-01-01T08:05:00')
    expect(determineStatus(checkIn, 'SHIFT_8', 10)).toBe('NORMAL')
  })

  it('works for SHIFT_10', () => {
    const checkIn = new Date('2024-01-01T10:20:00')
    expect(determineStatus(checkIn, 'SHIFT_10', 10)).toBe('LATE')
  })
})

describe('calculateOvertime', () => {
  it('returns 0 for null workHours', () => {
    expect(calculateOvertime(null)).toBe(0)
  })

  it('returns 0 when workHours equals standard', () => {
    expect(calculateOvertime(8)).toBe(0)
  })

  it('returns 0 when workHours is less than standard', () => {
    expect(calculateOvertime(6)).toBe(0)
  })

  it('returns overtime hours when workHours exceeds standard', () => {
    expect(calculateOvertime(10)).toBe(2)
  })

  it('uses custom standard hours', () => {
    expect(calculateOvertime(9, 7)).toBe(2)
  })
})
