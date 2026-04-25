import type { ReactNode } from "react"
import { Component } from "react"

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-cream p-8">
          <div className="mx-auto max-w-2xl border-4 border-black bg-white p-8 shadow-hard">
            <h1 className="font-headline text-4xl">Frontend Error</h1>
            <p className="mt-4 font-bold text-black/70">{this.state.error.message}</p>
            <pre className="mt-6 overflow-auto border-2 border-black bg-cream p-4 text-xs">
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
