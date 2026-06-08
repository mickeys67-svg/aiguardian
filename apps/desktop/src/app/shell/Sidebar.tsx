import { useApp, type MainSection } from "../state";

const ITEMS: Array<{ id: MainSection; label: string; icon: string }> = [
  { id: "coach", label: "코치", icon: "🧭" },
  { id: "home", label: "홈", icon: "🏠" },
  { id: "recipes", label: "레시피", icon: "📖" },
  { id: "projects", label: "프로젝트", icon: "📁" },
  { id: "learn", label: "학습", icon: "🎓" },
  { id: "settings", label: "설정", icon: "⚙️" },
];

export function Sidebar() {
  const section = useApp((s) => s.section);
  const setSection = useApp((s) => s.setSection);

  return (
    <aside className="w-56 shrink-0 border-r border-subtle/15 bg-surface flex flex-col">
      <div className="px-5 py-4 border-b border-subtle/10">
        <p className="font-bold text-ink text-lg">TG</p>
        <p className="text-[11px] text-subtle">v0.1 · Terminal Guardian</p>
      </div>
      <nav className="flex-1 py-3">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition ${
              section === item.id
                ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                : "text-subtle hover:bg-bg hover:text-ink border-l-2 border-transparent"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="px-5 py-3 border-t border-subtle/10 text-[11px] text-subtle">
        <p>입문자를 위한 가디언</p>
      </div>
    </aside>
  );
}
