import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { db as appDb, LifeAgentDatabase } from '../db/database'
import { OverviewPage } from '../pages/OverviewPage'
import {
  activitiesForDate,
  createActivity,
  createTask,
  deleteActivity,
  deleteTask,
  setTaskStatus,
  taskIdsForActivity,
  tasksForDate,
  updateActivity,
  updateTask,
} from '../services/records'
import {
  exportBackup,
  getLastBackupExportAt,
  parseBackup,
  recordBackupExportAt,
  restoreBackup,
} from '../services/backup'
import { getStoragePersistenceStatus, requestStoragePersistence } from '../services/storagePersistence'

let db: LifeAgentDatabase
let databaseName: string

beforeEach(() => {
  databaseName = `LifeAgentTest-${crypto.randomUUID()}`
  db = new LifeAgentDatabase(databaseName)
})

afterEach(async () => {
  cleanup()
  db.close()
  await indexedDB.deleteDatabase(databaseName)
})

describe('tasks', () => {
  it('creates, updates, queries across dates, explicitly completes, and deletes tasks', async () => {
    const first = await createTask({ plannedDate: '2026-10-12', title: '学习最优化' }, db)
    await createTask({ plannedDate: '2026-10-13', title: '整理概率论' }, db)
    await updateTask(first.id, { plannedDate: '2026-10-12', title: '学习最优化 PPT 1', details: '最后两页', priority: 'high' }, db)
    await setTaskStatus(first.id, 'completed', db)

    const dayOne = await tasksForDate('2026-10-12', db)
    expect(dayOne).toHaveLength(1)
    expect(dayOne[0]).toMatchObject({ title: '学习最优化 PPT 1', completionStatus: 'completed' })
    expect(await tasksForDate('2026-10-13', db)).toHaveLength(1)

    await deleteTask(first.id, db)
    expect(await tasksForDate('2026-10-12', db)).toEqual([])
  })
})

describe('activities and links', () => {
  it('creates, changes and deletes an activity with a task link', async () => {
    const task = await createTask({ plannedDate: '2026-10-12', title: '乐跑' }, db)
    const activity = await createActivity({
      startAt: '2026-10-12T17:00', endAt: '2026-10-12T18:20', content: '乐跑和健身', taskIds: [task.id],
    }, db)
    expect(await taskIdsForActivity(activity.id, db)).toEqual([task.id])

    await updateActivity(activity.id, {
      startAt: '2026-10-12T17:10', endAt: '2026-10-12T18:30', content: '乐跑和健身完成', taskIds: [],
    }, db)
    expect((await activitiesForDate('2026-10-12', db))[0].content).toBe('乐跑和健身完成')
    expect(await taskIdsForActivity(activity.id, db)).toEqual([])

    await deleteActivity(activity.id, db)
    expect(await activitiesForDate('2026-10-12', db)).toEqual([])
  })

  it('allows an unplanned activity and queries it by local activity date', async () => {
    const activity = await createActivity({
      startAt: '2026-10-10T00:15', endAt: '2026-10-10T00:45', content: '临时整理房间',
    }, db)
    expect(await taskIdsForActivity(activity.id, db)).toEqual([])
    expect(await activitiesForDate('2026-10-10', db)).toHaveLength(1)
    expect(await activitiesForDate('2026-10-11', db)).toHaveLength(0)
  })

  it('rejects invalid times and an end that is not after the start', async () => {
    await expect(createActivity({ startAt: 'bad', endAt: '2026-10-12T10:00', content: '测试' }, db)).rejects.toThrow('有效')
    await expect(createActivity({ startAt: '2026-10-12T10:00', endAt: '2026-10-12T09:00', content: '测试' }, db)).rejects.toThrow('晚于')
  })
})

describe('persistence and backup', () => {
  it('persists the selected completion status after closing and reopening the database', async () => {
    const task = await createTask({ plannedDate: '2026-10-12', title: '持久化任务' }, db)
    await setTaskStatus(task.id, 'completed', db)
    db.close()
    db = new LifeAgentDatabase(databaseName)
    expect((await tasksForDate('2026-10-12', db))[0]).toMatchObject({
      title: '持久化任务',
      completionStatus: 'completed',
    })
  })

  it('exports and restores tasks, activities and their links', async () => {
    const task = await createTask({ plannedDate: '2026-10-12', title: '备份任务' }, db)
    await setTaskStatus(task.id, 'not_completed', db)
    const activity = await createActivity({
      startAt: '2026-10-12T09:00',
      endAt: '2026-10-12T10:00',
      content: '备份活动',
      resultNotes: '保留结果说明',
      taskIds: [task.id],
    }, db)
    const backup = await exportBackup(db)
    await db.tasks.clear(); await db.activities.clear(); await db.taskActivityLinks.clear()
    await restoreBackup(backup, db)
    expect(await db.tasks.get(task.id)).toMatchObject({ title: '备份任务', completionStatus: 'not_completed' })
    expect(await db.activities.get(activity.id)).toMatchObject({ content: '备份活动', resultNotes: '保留结果说明' })
    expect(await taskIdsForActivity(activity.id, db)).toEqual([task.id])
  })

  it('rejects malformed and unsupported backups before changing data', async () => {
    await createTask({ plannedDate: '2026-10-12', title: '保留我' }, db)
    expect(() => parseBackup('{oops')).toThrow('有效的 JSON')
    expect(() => parseBackup(JSON.stringify({ app: 'LifeAgent', formatVersion: 99, data: {} }))).toThrow('版本 1')
    expect(await db.tasks.count()).toBe(1)
  })

  it('restores the same backup repeatedly without duplicating records or links', async () => {
    const task = await createTask({ plannedDate: '2026-10-12', title: '可重复恢复' }, db)
    await createActivity({
      startAt: '2026-10-12T08:00',
      endAt: '2026-10-12T09:00',
      content: '关联活动',
      taskIds: [task.id],
    }, db)
    const backup = await exportBackup(db)

    await restoreBackup(backup, db)
    await restoreBackup(backup, db)

    expect(await db.tasks.count()).toBe(1)
    expect(await db.activities.count()).toBe(1)
    expect(await db.taskActivityLinks.count()).toBe(1)
  })

  it('rolls back every table when restore fails after clearing current data', async () => {
    const original = await createTask({ plannedDate: '2026-10-12', title: '必须保留' }, db)
    const backup = await exportBackup(db)
    backup.data.tasks[0] = { ...backup.data.tasks[0], id: 'replacement', title: '替换内容' }
    vi.spyOn(db.activities, 'bulkAdd').mockRejectedValueOnce(new Error('模拟写入失败'))

    await expect(restoreBackup(backup, db)).rejects.toThrow('模拟写入失败')

    expect(await db.tasks.get(original.id)).toMatchObject({ title: '必须保留' })
    expect(await db.tasks.get('replacement')).toBeUndefined()
  })

  it('rejects impossible calendar dates in records and backups', async () => {
    await expect(createTask({ plannedDate: '2026-02-30', title: '无效日期' }, db)).rejects.toThrow('日期无效')
    const task = await createTask({ plannedDate: '2026-02-28', title: '有效日期' }, db)
    const backup = await exportBackup(db)
    backup.data.tasks = [{ ...task, plannedDate: '2026-02-30' }]
    expect(() => parseBackup(JSON.stringify(backup))).toThrow('结构或字段无效')
  })

  it('stores export reminder metadata without putting records in localStorage', () => {
    localStorage.clear()
    const exportedAt = '2026-10-12T12:34:56.000Z'
    recordBackupExportAt(exportedAt)
    expect(getLastBackupExportAt()).toBe(exportedAt)
    expect(localStorage.length).toBe(1)
    expect(localStorage.getItem('lifeagent:last-backup-export-at:v1')).toBe(exportedAt)
  })
})

describe('browser storage persistence', () => {
  it('reports unsupported and best-effort storage without overstating persistence', async () => {
    expect(await getStoragePersistenceStatus(undefined)).toBe('unsupported')
    expect(await getStoragePersistenceStatus({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    })).toBe('best-effort')
  })

  it('requests persistence and reports the browser decision', async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    }
    expect(await requestStoragePersistence(storage)).toBe('persistent')
    expect(storage.persist).toHaveBeenCalledOnce()
  })
})

describe('completion semantics', () => {
  it('writes every supported completion status to IndexedDB', async () => {
    const task = await createTask({ plannedDate: '2026-10-12', title: '状态切换' }, db)

    await setTaskStatus(task.id, 'completed', db)
    expect((await db.tasks.get(task.id))?.completionStatus).toBe('completed')
    expect((await db.tasks.get(task.id))?.completionConfirmedAt).toBeTruthy()

    await setTaskStatus(task.id, 'not_completed', db)
    expect((await db.tasks.get(task.id))?.completionStatus).toBe('not_completed')
    expect((await db.tasks.get(task.id))?.completionConfirmedAt).toBeTruthy()

    await setTaskStatus(task.id, 'unconfirmed', db)
    expect((await db.tasks.get(task.id))?.completionStatus).toBe('unconfirmed')
    expect((await db.tasks.get(task.id))?.completionConfirmedAt).toBeUndefined()
  })

  it('returns the saved status only for its corresponding historical date', async () => {
    const older = await createTask({ plannedDate: '2025-03-01', title: '历史任务' }, db)
    const newer = await createTask({ plannedDate: '2025-03-02', title: '另一天任务' }, db)
    await setTaskStatus(older.id, 'completed', db)
    await setTaskStatus(newer.id, 'not_completed', db)

    expect(await tasksForDate('2025-03-01', db)).toMatchObject([{ id: older.id, completionStatus: 'completed' }])
    expect(await tasksForDate('2025-03-02', db)).toMatchObject([{ id: newer.id, completionStatus: 'not_completed' }])
  })

  it('does not infer task completion from presence or absence of activities', async () => {
    const task = await createTask({ plannedDate: '2026-10-12', title: '需要用户确认' }, db)
    expect(await db.activities.count()).toBe(0)
    expect((await db.tasks.get(task.id))?.completionStatus).toBe('unconfirmed')
    await createActivity({ startAt: '2026-10-12T09:00', endAt: '2026-10-12T10:00', content: '相关活动', taskIds: [task.id] }, db)
    expect((await db.tasks.get(task.id))?.completionStatus).toBe('unconfirmed')
    await deleteActivity((await db.activities.toArray())[0].id, db)
    expect((await db.tasks.get(task.id))?.completionStatus).toBe('unconfirmed')
  })
})

describe('overview page', () => {
  it('renders the intro as two independent lines', () => {
    const { container } = render(createElement(OverviewPage))
    const intro = container.querySelector('.overview-intro')
    expect(intro?.children).toHaveLength(2)
    expect(intro?.children[0]).toHaveTextContent('计划与实际并排看。')
    expect(intro?.children[1]).toHaveTextContent('完成状态始终由你确认。')
  })

  it('shows the persisted status when navigating to a historical date', async () => {
    await appDb.transaction('rw', appDb.tasks, appDb.activities, appDb.taskActivityLinks, async () => {
      await appDb.taskActivityLinks.clear()
      await appDb.activities.clear()
      await appDb.tasks.clear()
    })
    const task = await createTask({ plannedDate: '2025-03-01', title: '历史页面任务' }, appDb)
    await setTaskStatus(task.id, 'not_completed', appDb)
    const { container } = render(createElement(OverviewPage))
    const dateInput = container.querySelector<HTMLInputElement>('input[type="date"]')
    expect(dateInput).not.toBeNull()

    fireEvent.change(dateInput!, { target: { value: '2025-03-01' } })

    expect(await screen.findByText('历史页面任务')).toBeInTheDocument()
    expect(await screen.findByText('未完成')).toBeInTheDocument()
  })
})
