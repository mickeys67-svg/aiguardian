import { useApp } from "../state";
import { Sidebar } from "./Sidebar";
import { Home } from "../sections/Home";
import { RecipesSection } from "../sections/RecipesSection";
import { Projects } from "../sections/Projects";
import { Learn } from "../sections/Learn";
import { Settings } from "../sections/Settings";
import { TerminalPane } from "../components/TerminalPane";

export function Shell() {
  const section = useApp((s) => s.section);

  return (
    <div className="flex w-full h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-12">
        <div className="px-10 py-10">
          {section === "home" && <Home />}
          {section === "recipes" && <RecipesSection />}
          {section === "projects" && <Projects />}
          {section === "learn" && <Learn />}
          {section === "settings" && <Settings />}
        </div>
      </main>
      {/* 항상 떠있는 터미널 패널 */}
      <TerminalPane defaultOpen={false} variant="bottom" />
    </div>
  );
}
