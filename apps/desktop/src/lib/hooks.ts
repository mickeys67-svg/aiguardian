import { useQuery } from "@tanstack/react-query";
import { inspectEnvironment } from "./tauri";

export function useEnvironment(force = false) {
  return useQuery({
    queryKey: ["environment", force],
    queryFn: () => inspectEnvironment(force),
    staleTime: 60_000,
  });
}
