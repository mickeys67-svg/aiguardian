// 전역 에러 경계 — React 트리 어딘가에서 throw 가 일어나도 화면이 흰 화면 되지 않게.
// 입문자에게 "잠깐 멈췄어요" 친화 메시지 + 재시도 + 진단 정보.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logTerminal } from "@/lib/terminalLog";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info);
    try {
      logTerminal({
        kind: "error",
        text: `🚨 React 에러: ${error.message}`,
        detail: info.componentStack ?? undefined,
      });
    } catch {
      /* ignore — logger 가 망가지면 콘솔이라도 */
    }
    this.setState({ info });
  }

  reset = () => this.setState({ hasError: false, error: null, info: null });

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg p-6">
        <div className="max-w-lg w-full rounded-2xl bg-surface border border-warning/40 p-6">
          <p className="text-4xl mb-3" aria-hidden>
            ☕
          </p>
          <h2 className="text-lg font-semibold text-ink mb-2">
            잠깐 멈췄어요
          </h2>
          <p className="text-sm text-ink mb-3">
            화면 그리는 중 에러가 났어요. 데이터는 안 잃었어요. 한 번만 다시
            시도해볼게요.
          </p>
          <p className="text-[11px] font-mono text-error/80 bg-error/5 rounded p-2 mb-4 max-h-32 overflow-auto">
            {this.state.error?.message ?? "알 수 없는 오류"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="flex-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90"
            >
              🔄 다시 시도
            </button>
            <button
              type="button"
              onClick={() => location.reload()}
              className="px-4 py-2 rounded-xl bg-surface border border-subtle/20 text-sm hover:border-primary/40"
            >
              앱 통째로 새로고침
            </button>
          </div>
          {this.state.info?.componentStack && (
            <details className="mt-4 text-[10px] text-subtle">
              <summary className="cursor-pointer">컴포넌트 스택 (개발자용)</summary>
              <pre className="mt-2 font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                {this.state.info.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
