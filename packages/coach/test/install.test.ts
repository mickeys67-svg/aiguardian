// 설치 로직 테스트 — settings.json 병합이 안전한지(보존·멱등·제거).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coachStopCommand,
  hasCoachStopHook,
  addCoachStopHook,
  removeCoachStopHook,
} from "../src/install/index.ts";

const CMD = coachStopCommand("/x/packages/tg-coach/stop-hook.ts");

test("coachStopCommand 는 식별 표식을 보장한다", () => {
  assert.ok(CMD.includes("tg-coach"));
  // 경로에 표식 없으면 인자로 부착
  assert.ok(coachStopCommand("/opt/run.ts").includes("--tg-coach"));
});

test("빈/없는 설정에 훅을 넣을 수 있다", () => {
  const out = addCoachStopHook(null, CMD);
  assert.ok(hasCoachStopHook(out));
});

test("기존 설정(mcpServers 등)을 보존하면서 훅 추가", () => {
  const before = { mcpServers: { tg: { command: "node" } }, enabledPlugins: { a: true } };
  const after = addCoachStopHook(before, CMD);
  assert.deepEqual(after.mcpServers, before.mcpServers);
  assert.deepEqual(after.enabledPlugins, before.enabledPlugins);
  assert.ok(hasCoachStopHook(after));
});

test("멱등 — 두 번 넣어도 훅은 하나", () => {
  const once = addCoachStopHook({}, CMD);
  const twice = addCoachStopHook(once, CMD);
  const groups = (twice.hooks as { Stop: unknown[] }).Stop;
  assert.equal(groups.length, 1);
});

test("사용자의 다른 Stop 훅은 보존하고 코치 것만 추가/제거", () => {
  const userHook = { hooks: [{ type: "command", command: "echo hi" }] };
  const withUser = { hooks: { Stop: [userHook] } };
  const added = addCoachStopHook(withUser, CMD);
  assert.equal((added.hooks as { Stop: unknown[] }).Stop.length, 2);

  const removed = removeCoachStopHook(added);
  const stop = (removed.hooks as { Stop: unknown[] }).Stop;
  assert.equal(stop.length, 1); // 사용자 훅만 남음
  assert.ok(!hasCoachStopHook(removed));
});

test("제거 후 빈 구조는 정리된다", () => {
  const added = addCoachStopHook({ enabledPlugins: {} }, CMD);
  const removed = removeCoachStopHook(added);
  assert.equal(removed.hooks, undefined); // hooks 통째로 사라짐
  assert.deepEqual(removed.enabledPlugins, {}); // 다른 건 보존
});
