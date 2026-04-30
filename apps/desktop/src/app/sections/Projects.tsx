export function Projects() {
  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink mb-1">프로젝트</h1>
        <p className="text-sm text-subtle">
          진행 중·완료·배포한 프로젝트들이 여기 모입니다.
        </p>
      </header>

      <div className="rounded-2xl bg-surface border border-subtle/15 p-8 text-center">
        <p className="text-4xl mb-3" aria-hidden>
          📁
        </p>
        <p className="text-sm text-ink mb-1">아직 시작한 프로젝트가 없어요</p>
        <p className="text-xs text-subtle">
          레시피에서 첫 프로젝트를 시작하면 여기에 자동으로 정리됩니다.
        </p>
      </div>
    </div>
  );
}
