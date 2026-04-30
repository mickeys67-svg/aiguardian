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
  /** 1 (highest) ~ 5 (lowest). 동시 발생 시 가장 낮은 값만 노출 */
  priority: number;
  message: string;
  /** ms, 자동 dismiss; null 이면 사용자 액션 대기 */
  ttlMs?: number | null;
  /** 어느 단계(0~9)에서만 유효한지 */
  stage?: number;
}

/**
 * 우선순위 큐. v0.9 §2.4 — 동시에 여러 팁이 발생하면 가장 중요한 1개만 노출.
 *
 * Week 5에 React hook + reducer 통합 예정. Week 1 시점에는 자료구조만.
 */
export class TipQueue {
  private items: Tip[] = [];

  enqueue(tip: Tip): void {
    this.items.push(tip);
    this.items.sort((a, b) => a.priority - b.priority);
  }

  next(): Tip | undefined {
    return this.items.shift();
  }

  peek(): Tip | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }
}
