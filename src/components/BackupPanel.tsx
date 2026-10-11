import { useRef, useState } from 'react'
import { exportBackup, parseBackup, restoreBackup } from '../services/backup'

export function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const download = async () => {
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `lifeagent-backup-${backup.exportedAt.slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setMessage('备份已导出。请把文件保存在安全位置。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导出失败')
    }
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      if (!window.confirm(`将用备份中的 ${backup.data.tasks.length} 个任务和 ${backup.data.activities.length} 条活动替换当前本地数据。继续吗？`)) return
      await restoreBackup(backup)
      setMessage('恢复完成。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '恢复失败')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <details className="backup-panel">
      <summary>数据备份</summary>
      <p>记录只保存在此浏览器中，不会自动同步到其他设备。清除浏览器数据或更换设备前，请先导出 JSON 备份并妥善保存。</p>
      <div className="button-row">
        <button className="secondary" onClick={download}>导出 JSON</button>
        <button className="secondary" onClick={() => inputRef.current?.click()}>从 JSON 恢复</button>
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
