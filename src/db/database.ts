import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Activity, Task, TaskActivityLink } from '../domain/models'

export class LifeAgentDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  activities!: EntityTable<Activity, 'id'>
  taskActivityLinks!: Table<TaskActivityLink, [string, string]>

  constructor(name = 'LifeAgentDatabase') {
    super(name)

    // Schema v1 deliberately keeps plans, actual events, and their links separate.
    // Future migrations are added as sequential this.version(...).stores(...) blocks.
    this.version(1).stores({
      tasks: 'id, plannedDate, completionStatus, createdAt, updatedAt',
      activities: 'id, activityDate, startAt, endAt, recordedAt, updatedAt',
      taskActivityLinks: '[taskId+activityId], taskId, activityId, createdAt',
    })
  }
}

export const db = new LifeAgentDatabase()
