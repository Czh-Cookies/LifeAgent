import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Task, TaskCompletionStatus, TaskPriority } from '../domain/models'
import { DateNavigator } from '../components/DateNavigator'
import { StatusPill } from '../components/StatusPill'
import { createTask, deleteTask, setTaskStatus, tasksForDate, updateTask } from '../services/records'
import { tomorrowKey } from '../utils/date'

const statusOptions: Array<{ value: TaskCompletionStatus; label: string }> = [
  { value: 'unconfirmed', label: '待确认' },
  { value: 'completed', label: '已完成' },
  { value: 'not_completed', label: '未完成' },
]

export function PlanPage() {
  const defaultDate = tomorrowKey()
  const [date, setDate] = useState(defaultDate)
  const [editing, setEditing] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState<TaskPriority | ''>('')
  const [error, setError] = useState('')
  const tasks = useLiveQuery(() => tasksForDate(date), [date], [])

  const clearForm = () => {
    setEditing(null)
    setTitle('')
    setDetails('')
    setPriority('')
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const input = { plannedDate: date, title, details, priority: priority || undefined }
      if (editing) await updateTask(editing.id, input)
      else await createTask(input)
      clearForm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    }
  }

  const edit = (task: Task) => {
    setEditing(task)
    setTitle(task.title)
    setDetails(task.details ?? '')
    setPriority(task.priority ?? '')
    setError('')
  }

  const remove = async (task: Task) => {
    if (!window.confirm(`删除“${task.title}”？相关活动不会被删除。`)) return
    try { await deleteTask(task.id) } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
    }
  }

  return (
    <section className="page">
      <header className="page-heading">
        <div><p className="eyebrow">PLAN WITH ROOM TO BREATHE</p><h1>明日计划</h1></div>
        <p>写下想完成的事，不必先安排每一分钟。</p>
      </header>
      <DateNavigator value={date} onChange={(next) => { setDate(next); clearForm() }} defaultDate={defaultDate} defaultLabel="回到明天" />

      <form className="editor-card" onSubmit={submit}>
        <h2>{editing ? '修改任务' : '添加一件事'}</h2>
        <label>任务名称<input autoFocus={Boolean(editing)} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：学习最优化第 1–2 个 PPT" maxLength={120} required /></label>
        <label>详细说明（可选）<textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="范围、预期结果或提醒" rows={2} maxLength={500} /></label>
        <label>优先级（可选）
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | '')}>
            <option value="">不设置</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option>
          </select>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="button-row"><button type="submit">{editing ? '保存修改' : '添加任务'}</button>{editing && <button type="button" className="secondary" onClick={clearForm}>取消</button>}</div>
      </form>

      <div className="list-heading"><h2>计划清单</h2><span>{tasks.length} 项</span></div>
      {tasks.length === 0 ? <div className="empty">这一天还没有计划。留白也可以，或者添加一件真正重要的事。</div> : (
        <div className="card-list">{tasks.map((task) => (
          <article className="record-card" key={task.id}>
            <div className="record-main"><div className="record-title-row"><h3>{task.title}</h3><StatusPill status={task.completionStatus} /></div>{task.details && <p>{task.details}</p>}{task.priority && <small>优先级：{{ high: '高', medium: '中', low: '低' }[task.priority]}</small>}</div>
            <div className="record-actions">
              <select aria-label={`${task.title}完成状态`} value={task.completionStatus} onChange={(e) => setTaskStatus(task.id, e.target.value as TaskCompletionStatus).catch((cause) => setError(cause.message))}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <button className="text-button" onClick={() => edit(task)}>修改</button><button className="text-button danger" onClick={() => remove(task)}>删除</button>
            </div>
          </article>
        ))}</div>
      )}
    </section>
  )
}
