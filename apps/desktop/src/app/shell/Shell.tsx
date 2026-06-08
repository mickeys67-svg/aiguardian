import { useApp } from "../state";
import { Sidebar } from "./Sidebar";
import { CoachDashboard } from "../coach/CoachDashboard";
import { Home } from "../sections/Home";
import { RecipesSection } from "../sections/RecipesSection";
import { Projects } from "../sections/Projects";
import { Learn } from "../sections/Learn";
import { Settings } from "../sections/Settings";

export function Shell() {
  const section = useApp((s) => s.section);

  return (
    <div className="flex w-full h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="px-10 py-10">
          {section === "coach" && <CoachDashboard />}
          {section === "home" && <Home />}
          {section === "recipes" && <RecipesSection />}
          {section === "projects" && <Projects />}
          {section === "learn" && <Learn />}
          {section === "settings" && <Settings />}
        </div>
      </main>
    </div>
  );
}
