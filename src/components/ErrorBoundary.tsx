import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LifeAgent UI or data read failed', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error" role="alert">
          <h1>暂时无法读取本地数据</h1>
          <p>{this.state.error.message}</p>
          <p>请不要清理浏览器数据。可先重新加载页面；若问题持续，请保留浏览器控制台信息。</p>
          <button onClick={() => window.location.reload()}>重新加载</button>
        </main>
      )
    }
    return this.props.children
  }
}
