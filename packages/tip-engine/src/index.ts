export type TipPattern =
  | "예고형"
  | "교육형"
  | "검증형"
  | "해석형"
  | "축하형"
  | "위로형";

export type TipTrigger = "시점" | "상태" | "맥락";

export interface Tip {
  id: string;
  pattern: TipPattern;
  trigger: TipTrigger;
  /** 1 (highest) ~ 5 (lowest). 동시 발생 시 가장 낮은 값만 노출 (v0.9 §2.4) */
  priority: number;
  message: string;
  /** ms, 자동 dismiss; null 이면 사용자 액션 대기 */
  ttlMs?: number | null;
  /** 어느 단계(0~9)에서만 유효한지 */
  stage?: number;
}

export class TipQueue {
  private items: Tip[] = [];
  private listeners = new Set<() => void>();

  enqueue(tip: Tip): void {
    if (this.items.some((t) => t.id === tip.id)) return;
    this.items.push(tip);
    this.items.sort((a, b) => a.priority - b.priority);
    this.notify();
  }

  next(): Tip | undefined {
    const t = this.items.shift();
    if (t) this.notify();
    return t;
  }

  peek(): Tip | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

/** 단일 인스턴스 — 앱 전역 큐 */
export const globalTipQueue = new TipQueue();
