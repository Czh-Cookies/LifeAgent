export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12)
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function tomorrowKey(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return toDateKey(date)
}

export function dateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${dateKey}T12:00:00`))
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function dateTimeLocalValue(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function dayBounds(dateKey: string): [string, string] {
  return [`${dateKey}T00:00:00.000`, `${dateKey}T23:59:59.999`]
}
