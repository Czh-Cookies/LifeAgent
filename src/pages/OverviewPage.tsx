import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DateNavigator } from '../components/DateNavigator'
import { StatusPill } from '../components/StatusPill'
import { activitiesForDate, taskIdsForActivity, tasksForDate } from '../services/records'
import { timeLabel, todayKey } from '../utils/date'

export function OverviewPage() {
  const today = todayKey()
  const [date, setDate] = useState(today)
  const tasks = useLiveQuery(() => tasksForDate(date), [date], [])
  const activities = useLiveQuery(() => activitiesForDate(date), [date], [])
  const links = useLiveQuery(async () => new Map(await Promise.all(activities.map(async (activity) => [activity.id, await taskIdsForActivity(activity.id)] as const))), [activities], new Map<string, string[]>())
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const completed = tasks.filter((task) => task.completionStatus === 'completed').length

  return (
    <section className="page">
      <header className="page-heading"><div><p className="eyebrow">A CLEAR VIEW, NOT A VERDICT</p><h1>今日总览</h1></div><p className="overview-intro"><span>计划与实际并排看。</span><span>完成状态始终由你确认。</span></p></header>
      <DateNavigator value={date} onChange={setDate} defaultDate={today} defaultLabel="回到今天" />
      <div className="summary-grid"><div><strong>{tasks.length}</strong><span>计划任务</span></div><div><strong>{completed}</strong><span>确认完成</span></div><div><strong>{activities.length}</strong><span>活动记录</span></div></div>
      <section className="overview-section"><div className="list-heading"><h2>计划</h2><span>{tasks.filter((task) => task.completionStatus === 'unconfirmed').length} 项待确认</span></div>{tasks.length === 0 ? <div className="empty compact">当天没有制定计划。</div> : <div className="compact-list">{tasks.map((task) => <div className="compact-task" key={task.id}><span>{task.title}</span><StatusPill status={task.completionStatus} /></div>)}</div>}</section>
      <section className="overview-section"><div className="list-heading"><h2>实际时间线</h2><span>{activities.length} 条记录</span></div>{activities.length === 0 ? <div className="empty compact">当天尚无活动记录；计划的完成状态不会因此被改变。</div> : <div className="timeline">{activities.map((activity) => <article className="timeline-item" key={activity.id}><div className="timeline-time">{timeLabel(activity.startAt)}<span>—</span>{timeLabel(activity.endAt)}</div><div className="timeline-card"><h3>{activity.content}</h3>{activity.resultNotes && <p>{activity.resultNotes}</p>}{(links.get(activity.id) ?? []).map((id) => taskById.get(id)).filter(Boolean).map((task) => <span className="linked-task" key={task?.id}>↳ {task?.title}</span>)}</div></article>)}</div>}</section>
      <p className="data-note">没有活动记录 ≠ 没有完成任务。LifeAgent 不会替你推断完成状态。</p>
    </section>
  )
}
