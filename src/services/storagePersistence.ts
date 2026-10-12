export type StoragePersistenceStatus = 'persistent' | 'best-effort' | 'unsupported' | 'error'

type PersistenceStorageManager = Pick<StorageManager, 'persisted' | 'persist'>

function browserStorageManager(): PersistenceStorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

export async function getStoragePersistenceStatus(
  storage = browserStorageManager(),
): Promise<StoragePersistenceStatus> {
  if (!storage?.persisted) return 'unsupported'
  try {
    return await storage.persisted() ? 'persistent' : 'best-effort'
  } catch {
    return 'error'
  }
}

export async function requestStoragePersistence(
  storage = browserStorageManager(),
): Promise<StoragePersistenceStatus> {
  if (!storage?.persisted || !storage.persist) return 'unsupported'
  try {
    if (await storage.persisted()) return 'persistent'
    return await storage.persist() ? 'persistent' : 'best-effort'
  } catch {
    return 'error'
  }
}
