import { useEffect, useRef, useState } from 'react'

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>

export function PwaUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updating, setUpdating] = useState(false)
  const updateServiceWorker = useRef<UpdateServiceWorker | null>(null)

  useEffect(() => {
    let active = true
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (!active) return
      updateServiceWorker.current = registerSW({
        immediate: true,
        onNeedRefresh: () => setNeedRefresh(true),
        onRegisterError: (error) => console.error('Service Worker 注册失败', error),
      })
    }).catch((error: unknown) => console.error('PWA 更新模块加载失败', error))
    return () => { active = false }
  }, [])

  if (!needRefresh) return null

  const update = async () => {
    if (!updateServiceWorker.current) return
    setUpdating(true)
    try {
      await updateServiceWorker.current(true)
    } catch (error) {
      console.error('应用更新失败', error)
      setUpdating(false)
    }
  }

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <p><strong>新版本已准备好</strong><span>请先保存正在填写的内容，再更新应用。</span></p>
      <div className="button-row">
        <button onClick={update} disabled={updating}>{updating ? '正在更新…' : '立即更新'}</button>
        <button className="secondary" onClick={() => setNeedRefresh(false)} disabled={updating}>稍后</button>
      </div>
    </aside>
  )
}
