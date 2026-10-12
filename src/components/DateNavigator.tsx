import { dateLabel, todayKey } from '../utils/date'

type Props = {
  value: string
  onChange: (value: string) => void
  defaultDate: string
  defaultLabel: string
}

export function DateNavigator({ value, onChange, defaultDate, defaultLabel }: Props) {
  const move = (days: number) => {
    const date = new Date(`${value}T12:00:00`)
    date.setDate(date.getDate() + days)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    onChange(`${year}-${month}-${day}`)
  }

  return (
    <div className="date-nav">
      <button className="icon-button" onClick={() => move(-1)} aria-label="前一天">←</button>
      <label className="date-picker">
        <span>{dateLabel(value)}</span>
        <input aria-label="选择日期" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      <button className="icon-button" onClick={() => move(1)} aria-label="后一天">→</button>
      {value !== defaultDate && (
        <button className="text-button" onClick={() => onChange(defaultDate)}>
          {defaultLabel}{defaultDate === todayKey() ? '' : ''}
        </button>
      )}
    </div>
  )
}
