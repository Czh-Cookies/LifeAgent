export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskCompletionStatus = 'unconfirmed' | 'completed' | 'not_completed'

export interface Task {
  id: string
  plannedDate: string
  title: string
  details?: string
  priority?: TaskPriority
  completionStatus: TaskCompletionStatus
  completionConfirmedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  activityDate: string
  startAt: string
  endAt: string
  content: string
  resultNotes?: string
  recordedAt: string
  updatedAt: string
}

export interface TaskActivityLink {
  taskId: string
  activityId: string
  createdAt: string
}

export interface BackupFile {
  app: 'LifeAgent'
  formatVersion: 1
  exportedAt: string
  data: {
    tasks: Task[]
    activities: Activity[]
    links: TaskActivityLink[]
  }
}
