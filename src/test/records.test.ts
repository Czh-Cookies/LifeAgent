import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
import { exportBackup, parseBackup, restoreBackup } from '../services/backup'

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
