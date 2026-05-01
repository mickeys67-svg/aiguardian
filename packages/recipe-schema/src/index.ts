import { z } from "zod";

// v0.9 §4.4 Recipe 엔티티 + 부록 B 1차 레시피 후보 10종 메타.

export const RecipeDifficulty = z.enum(["입문", "입문+", "중급", "고급"]);
export type RecipeDifficulty = z.infer<typeof RecipeDifficulty>;

export const RecipeCategory = z.enum([
  "web",
  "automation",
  "bot",
  "data",
  "game",
  "portfolio",
]);
export type RecipeCategory = z.infer<typeof RecipeCategory>;

/** 결과물 검증 방식 — Artifact 화면 분기. */
export const VerifyKind = z.enum([
  "html",
  "bot",
  "cli",
  "python",
  "data",
  "web",
]);
export type VerifyKind = z.infer<typeof VerifyKind>;

export const RecipeStep = z.object({
  id: z.string(),
  title: z.string(),
  command: z.string().optional(),
  // dry-run 미리보기용 설명. v0.9 §3.4 실행·결과 화면.
  description: z.string(),
  /** 실패해도 레시피를 계속 진행할지 */
  optional: z.boolean().default(false),
});

export const Recipe = z.object({
  id: z.string(),
  title: z.string(),
  category: RecipeCategory,
  difficulty: RecipeDifficulty,
  estMinutes: z.number().int().positive(),
  description: z.string(),
  /** 입문자에게 보여줄 한 줄 결과 가치 */
  outcome: z.string(),
  /** 실행 전 필요한 도구 */
  requires: z.array(z.string()),
  promptTemplate: z.string(),
  steps: z.array(RecipeStep).min(1),
  /** 추천 표시 (⭐) */
  featured: z.boolean().default(false),
  /** 결과 검증 방식 — 미지정 시 'html' 가정 */
  verifyKind: VerifyKind.optional(),
  /** 결과를 띄울 때 실행할 명령 (예: "npm run dev", "streamlit run app.py") */
  runCommand: z.string().optional(),
  /** 결과 띄우기 후 접속할 로컬 주소 (예: "http://localhost:5173") */
  localUrl: z.string().optional(),
});
export type Recipe = z.infer<typeof Recipe>;

export function parseRecipe(input: unknown): Recipe {
  return Recipe.parse(input);
}
