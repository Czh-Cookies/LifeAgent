import { db as defaultDb } from '../db/database'
import type { Activity, BackupFile, Task, TaskActivityLink } from '../domain/models'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'
const isIso = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))
const isOptionalString = (value: unknown): value is string | undefined => value === undefined || isString(value)
const isOptionalIso = (value: unknown): value is string | undefined => value === undefined || isIso(value)
const isDateKey = (value: unknown): value is string =>
  isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`))

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isDateKey(value.plannedDate) &&
    isString(value.title) && value.title.trim().length > 0 &&
    isOptionalString(value.details) &&
    (value.priority === undefined || ['low', 'medium', 'high'].includes(String(value.priority))) &&
    ['unconfirmed', 'completed', 'not_completed'].includes(String(value.completionStatus)) &&
    isOptionalIso(value.completionConfirmedAt) &&
    isIso(value.createdAt) && isIso(value.updatedAt)
  )
}

function isActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false
  return (
    isString(value.id) && isDateKey(value.activityDate) &&
    isIso(value.startAt) && isIso(value.endAt) &&
    new Date(value.endAt).getTime() > new Date(value.startAt).getTime() &&
    isString(value.content) && value.content.trim().length > 0 &&
    isOptionalString(value.resultNotes) &&
    isIso(value.recordedAt) && isIso(value.updatedAt)
  )
}

function isLink(value: unknown): value is TaskActivityLink {
  return isRecord(value) && isString(value.taskId) && value.taskId.length > 0 &&
    isString(value.activityId) && value.activityId.length > 0 && isIso(value.createdAt)
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!isRecord(parsed) || parsed.app !== 'LifeAgent' || parsed.formatVersion !== 1 || !isRecord(parsed.data)) {
    throw new Error('不是受支持的 LifeAgent 备份（仅支持格式版本 1）')
  }
  const { tasks, activities, links } = parsed.data
  if (!Array.isArray(tasks) || !tasks.every(isTask) ||
      !Array.isArray(activities) || !activities.every(isActivity) ||
      !Array.isArray(links) || !links.every(isLink) || !isIso(parsed.exportedAt)) {
    throw new Error('备份数据结构或字段无效')
  }
  const taskIds = new Set(tasks.map((item) => item.id))
  const activityIds = new Set(activities.map((item) => item.id))
  if (taskIds.size !== tasks.length || activityIds.size !== activities.length) {
    throw new Error('备份包含重复 ID')
  }
  const linkKeys = new Set<string>()
  for (const link of links) {
    const key = `${link.taskId}\0${link.activityId}`
    if (!taskIds.has(link.taskId) || !activityIds.has(link.activityId) || linkKeys.has(key)) {
      throw new Error('备份包含无效或重复的任务关联')
    }
    linkKeys.add(key)
  }
  return parsed as unknown as BackupFile
}

export async function exportBackup(database = defaultDb): Promise<BackupFile> {
  const [tasks, activities, links] = await Promise.all([
    database.tasks.toArray(),
    database.activities.toArray(),
    database.taskActivityLinks.toArray(),
  ])
  return {
    app: 'LifeAgent',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    data: { tasks, activities, links },
  }
}

export async function restoreBackup(backup: BackupFile, database = defaultDb): Promise<void> {
  // Re-validate a serialized copy so callers cannot bypass validation with a cast.
  const checked = parseBackup(JSON.stringify(backup))
  await database.transaction(
    'rw',
    database.tasks,
    database.activities,
    database.taskActivityLinks,
    async () => {
      await database.taskActivityLinks.clear()
      await database.activities.clear()
      await database.tasks.clear()
      await database.tasks.bulkAdd(checked.data.tasks)
      await database.activities.bulkAdd(checked.data.activities)
      await database.taskActivityLinks.bulkAdd(checked.data.links)
    },
  )
}
