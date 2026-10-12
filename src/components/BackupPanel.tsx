import { useEffect, useRef, useState } from 'react'
import {
  exportBackup,
  getLastBackupExportAt,
  getLocalDataCounts,
  parseBackup,
  recordBackupExportAt,
  restoreBackup,
} from '../services/backup'
import {
  getStoragePersistenceStatus,
  requestStoragePersistence,
  type StoragePersistenceStatus,
} from '../services/storagePersistence'

function localDateTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

const persistenceCopy: Record<StoragePersistenceStatus | 'checking', string> = {
  checking: '正在检查浏览器的存储保护能力…',
  persistent: '浏览器已授予持久化存储，可降低系统自动清理数据的风险。',
  'best-effort': '当前为尽力保存模式，浏览器仍可能在存储紧张时清理数据。',
  unsupported: '此浏览器不提供持久化存储申请，务必定期导出备份。',
  error: '无法确认当前存储保护状态，务必定期导出备份。',
}

export function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [lastExportAt, setLastExportAt] = useState(() => getLastBackupExportAt())
  const [persistenceStatus, setPersistenceStatus] = useState<StoragePersistenceStatus | 'checking'>('checking')

  useEffect(() => {
    let active = true
    void getStoragePersistenceStatus().then((status) => {
      if (active) setPersistenceStatus(status)
    })
    return () => { active = false }
  }, [])

  const download = async () => {
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `lifeagent-backup-${backup.exportedAt.slice(0, 10)}.json`
      anchor.style.display = 'none'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      recordBackupExportAt(backup.exportedAt)
      setLastExportAt(backup.exportedAt)
      setMessage('备份文件已生成并交给浏览器下载。请到“文件”或“下载”中确认文件已保存。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败')
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      const current = await getLocalDataCounts()
      const warning = [
        `备份时间：${localDateTime(backup.exportedAt)}`,
        `将用备份中的 ${backup.data.tasks.length} 个任务、${backup.data.activities.length} 条活动和 ${backup.data.links.length} 个关联，`,
        `永久覆盖当前的 ${current.tasks} 个任务、${current.activities} 条活动和 ${current.links} 个关联。`,
        '重复导入同一文件不会叠加记录，但会再次覆盖当前数据。建议先导出当前数据。继续吗？',
      ].join('\n')
      if (!window.confirm(warning)) {
        setMessage('已取消恢复，当前数据未改变。')
        return
      }
      await restoreBackup(backup)
      setMessage('恢复完成；任务、活动和关联已作为一个事务写入。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复失败')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const requestPersistence = async () => {
    setPersistenceStatus('checking')
    setPersistenceStatus(await requestStoragePersistence())
  }

  return (
    <details className="backup-panel">
      <summary>数据备份</summary>
      <p>记录只保存在此浏览器中，不会自动同步到其他设备。清除浏览器数据或更换设备前，请先导出 JSON 备份并妥善保存。</p>
      <p>iPhone 上的 Safari 页面与“添加到主屏幕”后的应用可能使用独立数据空间；切换使用方式前，请先导出并确认备份文件已保存。</p>
      <p className="backup-status">
        <strong>最近一次成功导出：</strong>
        {lastExportAt ? localDateTime(lastExportAt) : '尚无记录'}
        <small>这里只表示应用已生成文件并发起下载，无法确认文件是否已安全保存。</small>
      </p>
      <p className="storage-status">{persistenceCopy[persistenceStatus]} 即使已授予，也不能防止用户清除网站数据、卸载应用、设备损坏或更换设备。</p>
      <div className="button-row">
        <button className="secondary" onClick={download}>导出 JSON</button>
        <button className="secondary" onClick={() => inputRef.current?.click()}>从 JSON 恢复</button>
        {(persistenceStatus === 'best-effort' || persistenceStatus === 'error') && (
          <button className="secondary" onClick={requestPersistence}>申请增强存储保护</button>
        )}
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="application/json,.json"
          onChange={(event) => importFile(event.target.files?.[0])}
        />
      </div>
      {message && <p className="inline-message" role="status">{message}</p>}
    </details>
  )
}
