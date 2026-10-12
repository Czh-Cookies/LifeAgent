import { useState } from 'react'
import { ActivityPage } from './pages/ActivityPage'
import { OverviewPage } from './pages/OverviewPage'
import { PlanPage } from './pages/PlanPage'
import { BackupPanel } from './components/BackupPanel'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'

type Page = 'overview' | 'plan' | 'activity'

const navigation: Array<{ id: Page; label: string; icon: string }> = [
  { id: 'overview', label: '总览', icon: '◉' },
  { id: 'plan', label: '计划', icon: '＋' },
  { id: 'activity', label: '记录', icon: '↗' },
]

export default function App() {
  const [page, setPage] = useState<Page>('overview')

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => setPage('overview')} aria-label="返回总览">
          <span className="brand-mark">L</span><span>LifeAgent</span>
        </button>
        <span className="local-badge">● 本地保存</span>
      </header>
      <main>
        {page === 'overview' && <OverviewPage />}
        {page === 'plan' && <PlanPage />}
        {page === 'activity' && <ActivityPage />}
        <BackupPanel />
      </main>
      <nav className="bottom-nav" aria-label="主要导航">
        {navigation.map((item) => (
          <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)} aria-current={page === item.id ? 'page' : undefined}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <PwaUpdatePrompt />
    </div>
  )
}
