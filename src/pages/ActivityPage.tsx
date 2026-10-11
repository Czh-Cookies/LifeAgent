import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Activity } from '../domain/models'
import { DateNavigator } from '../components/DateNavigator'
import { activitiesForDate, createActivity, deleteActivity, taskIdsForActivity, tasksForDate, updateActivity } from '../services/records'
import { dateTimeLocalValue, timeLabel, todayKey } from '../utils/date'

const defaultTimes = (date: string) => ({ start: `${date}T09:00`, end: `${date}T10:00` })

export function ActivityPage() {
  const defaultDate = todayKey()
  const [date, setDate] = useState(defaultDate)
  const initial = defaultTimes(defaultDate)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [startAt, setStartAt] = useState(initial.start)
  const [endAt, setEndAt] = useState(initial.end)
  const [content, setContent] = useState('')
  const [resultNotes, setResultNotes] = useState('')
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const activities = useLiveQuery(() => activitiesForDate(date), [date], [])
  const tasks = useLiveQuery(() => tasksForDate(date), [date], [])
  const links = useLiveQuery(async () => {
    const pairs = await Promise.all(activities.map(async (item) => [item.id, await taskIdsForActivity(item.id)] as const))
    return new Map(pairs)
  }, [activities], new Map<string, string[]>())

  const clearForm = (forDate = date) => {
    const times = defaultTimes(forDate)
    setEditing(null); setStartAt(times.start); setEndAt(times.end); setContent(''); setResultNotes(''); setTaskIds([]); setError('')
  }

  const changeDate = (next: string) => { setDate(next); clearForm(next) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const input = { startAt, endAt, content, resultNotes, taskIds }
      if (editing) await updateActivity(editing.id, input)
      else await createActivity(input)
      clearForm()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败') }
  }

  const edit = async (activity: Activity) => {
    setEditing(activity)
    setStartAt(dateTimeLocalValue(activity.startAt)); setEndAt(dateTimeLocalValue(activity.endAt))
    setContent(activity.content); setResultNotes(activity.resultNotes ?? '')
    setTaskIds(await taskIdsForActivity(activity.id)); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (activity: Activity) => {
    if (!window.confirm(`删除“${activity.content}”？`)) return
    try { await deleteActivity(activity.id) } catch (cause) { setError(cause instanceof Error ? cause.message : '删除失败') }
  }

  return (
    <section className="page">
      <header className="page-heading"><div><p className="eyebrow">WHAT ACTUALLY HAPPENED</p><h1>实际记录</h1></div><p>记录真实发生的事，也包括计划之外的生活。</p></header>
      <DateNavigator value={date} onChange={changeDate} defaultDate={defaultDate} defaultLabel="回到今天" />
      <form className="editor-card" onSubmit={submit}>
        <h2>{editing ? '修改活动' : '记一段活动'}</h2>
        <div className="time-grid"><label>开始时间<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required /></label><label>结束时间<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required /></label></div>
        <label>具体做了什么<input value={content} onChange={(e) => setContent(e.target.value)} placeholder="例如：学习最优化 PPT 1" maxLength={160} required /></label>
        <label>结果与困难（可选）<textarea value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} placeholder="完成到哪里？遇到了什么困难？" rows={3} maxLength={800} /></label>
        <fieldset><legend>关联计划（可选，可多选）</legend>{tasks.length === 0 ? <p className="muted">这一天没有计划任务，活动仍可直接保存。</p> : <div className="check-list">{tasks.map((task) => <label className="check-item" key={task.id}><input type="checkbox" checked={taskIds.includes(task.id)} onChange={(e) => setTaskIds((current) => e.target.checked ? [...current, task.id] : current.filter((id) => id !== task.id))} /><span>{task.title}</span></label>)}</div>}</fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="button-row"><button type="submit">{editing ? '保存修改' : '保存活动'}</button>{editing && <button type="button" className="secondary" onClick={() => clearForm()}>取消</button>}</div>
      </form>

      <div className="list-heading"><h2>活动时间线</h2><span>{activities.length} 条</span></div>
      {activities.length === 0 ? <div className="empty">还没有活动记录。这只表示“尚未记录”，不代表计划没有完成。</div> : <div className="timeline">{activities.map((activity) => <article className="timeline-item" key={activity.id}><div className="timeline-time">{timeLabel(activity.startAt)}<span>—</span>{timeLabel(activity.endAt)}</div><div className="timeline-card"><h3>{activity.content}</h3>{activity.resultNotes && <p>{activity.resultNotes}</p>}{(links.get(activity.id)?.length ?? 0) > 0 && <small>已关联 {links.get(activity.id)?.length} 个计划</small>}<div className="record-actions"><button className="text-button" onClick={() => edit(activity)}>修改</button><button className="text-button danger" onClick={() => remove(activity)}>删除</button></div></div></article>)}</div>}
    </section>
  )
}
