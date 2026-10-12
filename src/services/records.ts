import type { LifeAgentDatabase } from '../db/database'
import { db as defaultDb } from '../db/database'
import type {
  Activity,
  Task,
  TaskActivityLink,
  TaskCompletionStatus,
  TaskPriority,
} from '../domain/models'
import { isValidDateKey, toDateKey } from '../utils/date'

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

function requiredText(value: string, field: string): string {
  const cleaned = value.trim()
  if (!cleaned) throw new Error(`${field}不能为空`)
  return cleaned
}

export type TaskInput = {
  plannedDate: string
  title: string
  details?: string
  priority?: TaskPriority
}

export async function createTask(input: TaskInput, database = defaultDb): Promise<Task> {
  if (!isValidDateKey(input.plannedDate)) throw new Error('计划日期无效')
  const now = new Date().toISOString()
  const task: Task = {
    id: newId(),
    plannedDate: input.plannedDate,
    title: requiredText(input.title, '任务名称'),
    details: input.details?.trim() || undefined,
    priority: input.priority,
    completionStatus: 'unconfirmed',
    createdAt: now,
    updatedAt: now,
  }
  await database.tasks.add(task)
  return task
}

export async function updateTask(
  id: string,
  input: TaskInput,
  database = defaultDb,
): Promise<void> {
  if (!isValidDateKey(input.plannedDate)) throw new Error('计划日期无效')
  const changed = await database.tasks.update(id, {
    plannedDate: input.plannedDate,
    title: requiredText(input.title, '任务名称'),
    details: input.details?.trim() || undefined,
    priority: input.priority,
    updatedAt: new Date().toISOString(),
  })
  if (!changed) throw new Error('要修改的任务不存在')
}

export async function setTaskStatus(
  id: string,
  status: TaskCompletionStatus,
  database = defaultDb,
): Promise<void> {
  const now = new Date().toISOString()
  const changed = await database.tasks.update(id, {
    completionStatus: status,
    completionConfirmedAt: status === 'unconfirmed' ? undefined : now,
    updatedAt: now,
  })
  if (!changed) throw new Error('任务不存在')
}

export async function deleteTask(id: string, database = defaultDb): Promise<void> {
  await database.transaction('rw', database.tasks, database.taskActivityLinks, async () => {
    await database.taskActivityLinks.where('taskId').equals(id).delete()
    await database.tasks.delete(id)
  })
}

export async function tasksForDate(date: string, database = defaultDb): Promise<Task[]> {
  return database.tasks.where('plannedDate').equals(date).sortBy('createdAt')
}

export type ActivityInput = {
  startAt: string
  endAt: string
  content: string
  resultNotes?: string
  taskIds?: string[]
}

function validateActivity(input: ActivityInput): void {
  const start = new Date(input.startAt).getTime()
  const end = new Date(input.endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('请输入有效的开始和结束时间')
  if (end <= start) throw new Error('结束时间必须晚于开始时间')
  requiredText(input.content, '活动内容')
}

async function assertTasksExist(ids: string[], database: LifeAgentDatabase): Promise<void> {
  const unique = [...new Set(ids)]
  const count = await database.tasks.where('id').anyOf(unique).count()
  if (count !== unique.length) throw new Error('关联的计划任务不存在')
}

export async function createActivity(
  input: ActivityInput,
  database = defaultDb,
): Promise<Activity> {
  validateActivity(input)
  const taskIds = [...new Set(input.taskIds ?? [])]
  if (taskIds.length) await assertTasksExist(taskIds, database)
  const now = new Date().toISOString()
  const activity: Activity = {
    id: newId(),
    activityDate: toDateKey(new Date(input.startAt)),
    startAt: new Date(input.startAt).toISOString(),
    endAt: new Date(input.endAt).toISOString(),
    content: requiredText(input.content, '活动内容'),
    resultNotes: input.resultNotes?.trim() || undefined,
    recordedAt: now,
    updatedAt: now,
  }
  await database.transaction('rw', database.activities, database.taskActivityLinks, async () => {
    await database.activities.add(activity)
    if (taskIds.length) {
      await database.taskActivityLinks.bulkAdd(
        taskIds.map((taskId): TaskActivityLink => ({ taskId, activityId: activity.id, createdAt: now })),
      )
    }
  })
  return activity
}

export async function updateActivity(
  id: string,
  input: ActivityInput,
  database = defaultDb,
): Promise<void> {
  validateActivity(input)
  const taskIds = [...new Set(input.taskIds ?? [])]
  if (taskIds.length) await assertTasksExist(taskIds, database)
  const now = new Date().toISOString()
  await database.transaction('rw', database.activities, database.taskActivityLinks, async () => {
    const changed = await database.activities.update(id, {
      activityDate: toDateKey(new Date(input.startAt)),
      startAt: new Date(input.startAt).toISOString(),
      endAt: new Date(input.endAt).toISOString(),
      content: requiredText(input.content, '活动内容'),
      resultNotes: input.resultNotes?.trim() || undefined,
      updatedAt: now,
    })
    if (!changed) throw new Error('要修改的活动不存在')
    await database.taskActivityLinks.where('activityId').equals(id).delete()
    if (taskIds.length) {
      await database.taskActivityLinks.bulkAdd(
        taskIds.map((taskId): TaskActivityLink => ({ taskId, activityId: id, createdAt: now })),
      )
    }
  })
}

export async function deleteActivity(id: string, database = defaultDb): Promise<void> {
  await database.transaction('rw', database.activities, database.taskActivityLinks, async () => {
    await database.taskActivityLinks.where('activityId').equals(id).delete()
    await database.activities.delete(id)
  })
}

export async function activitiesForDate(date: string, database = defaultDb): Promise<Activity[]> {
  return database.activities.where('activityDate').equals(date).sortBy('startAt')
}

export async function taskIdsForActivity(id: string, database = defaultDb): Promise<string[]> {
  const links = await database.taskActivityLinks.where('activityId').equals(id).toArray()
  return links.map((link) => link.taskId)
}
