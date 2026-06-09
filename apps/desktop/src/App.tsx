// 코치가 앱 전부다 — 옛 온보딩 마법사는 제거됨. Shell(코치 대시보드 + 섹션) + 팁 토스트만.
import { TipToast } from "./app/TipToast";
import { Shell } from "./app/shell/Shell";

export default function App() {
  return (
    <>
      <Shell />
      <TipToast />
    </>
  );
}
