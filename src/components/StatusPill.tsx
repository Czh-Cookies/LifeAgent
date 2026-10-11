import type { TaskCompletionStatus } from '../domain/models'

const labels: Record<TaskCompletionStatus, string> = {
  unconfirmed: '待确认',
  completed: '已完成',
  not_completed: '未完成',
}

export function StatusPill({ status }: { status: TaskCompletionStatus }) {
  return <span className={`status status-${status}`}>{labels[status]}</span>
}
