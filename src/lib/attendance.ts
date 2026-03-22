type AccessLogEntry = {
  direction: string  // 'IN' | 'OUT'
  accessTime: Date
}

type CheckInOutResult = {
  checkIn: Date | null
  checkOut: Date | null
  isAnomaly: boolean
}

export function getShiftStartTime(shiftType: string): number {
  switch (shiftType) {
    case 'SHIFT_8': return 8
    case 'SHIFT_9': return 9
    case 'SHIFT_10': return 10
    default: return 9
  }
}

export function determineCheckInOut(logs: AccessLogEntry[]): CheckInOutResult {
  if (logs.length === 0) {
    return { checkIn: null, checkOut: null, isAnomaly: false }
  }
  const inLogs = logs.filter((l) => l.direction === 'IN')
  const outLogs = logs.filter((l) => l.direction === 'OUT')
  const checkIn = inLogs.length > 0
    ? inLogs.reduce((earliest, log) => log.accessTime < earliest.accessTime ? log : earliest).accessTime
    : null
  const checkOut = outLogs.length > 0
    ? outLogs.reduce((latest, log) => log.accessTime > latest.accessTime ? log : latest).accessTime
    : null
  const isAnomaly = (checkIn !== null && checkOut === null) || (checkIn === null && checkOut !== null)
  return { checkIn, checkOut, isAnomaly }
}

export function calculateWorkHours(checkIn: Date, checkOut: Date | null, lunchBreakHours: number = 1): number | null {
  if (!checkOut) return null
  const diffMs = checkOut.getTime() - checkIn.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return Math.max(0, diffHours - lunchBreakHours)
}

export function determineStatus(checkIn: Date | null, shiftType: string, gracePeriodMinutes: number): string {
  if (!checkIn) return 'ABSENT'
  const shiftStart = getShiftStartTime(shiftType)
  const totalMinutes = checkIn.getHours() * 60 + checkIn.getMinutes()
  const shiftMinutes = shiftStart * 60 + gracePeriodMinutes
  return totalMinutes <= shiftMinutes ? 'NORMAL' : 'LATE'
}

export function calculateOvertime(workHours: number | null, standardHours: number = 8): number {
  if (workHours === null) return 0
  return Math.max(0, workHours - standardHours)
}
