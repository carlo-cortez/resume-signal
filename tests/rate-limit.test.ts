import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RATE_LIMITS,
  consumeGlobalRateLimit,
  consumeUserRateLimit,
  rateLimitMessage,
  secondsUntilWindowEnds,
} from "@/lib/api/rate-limit";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(result: RpcResult | Error) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as Pick<SupabaseClient, "rpc">;
  return { client, calls };
}

const quiet = () => {
  const original = console.error;
  console.error = () => {};
  return () => { console.error = original; };
};

test("allows requests up to the per-user limit and calls the user-scoped function", async () => {
  const { client, calls } = fakeClient({ data: RATE_LIMITS.resume_parse.limit, error: null });
  const result = await consumeUserRateLimit(client, "resume_parse");
  assert.deepEqual(result, { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(calls, [{
    name: "consume_user_rate_limit",
    args: { p_bucket: "resume_parse", p_window_seconds: 3_600 },
  }]);
});

test("rejects the request after the limit with a retry window", async () => {
  const { client } = fakeClient({ data: RATE_LIMITS.resume_scan.limit + 1, error: null });
  const result = await consumeUserRateLimit(client, "resume_scan");
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= 3_600);
});

test("per-user limits fail open when the database check errors", async () => {
  const restore = quiet();
  try {
    assert.equal((await consumeUserRateLimit(fakeClient({ data: null, error: { message: "timeout" } }).client, "resume_parse")).allowed, true);
    assert.equal((await consumeUserRateLimit(fakeClient(new Error("network")).client, "resume_scan")).allowed, true);
  } finally {
    restore();
  }
});

test("the global AI budget uses the server-only function and enforces its daily cap", async () => {
  const { client, calls } = fakeClient({ data: RATE_LIMITS.groq_requests.limit + 1, error: null });
  assert.equal((await consumeGlobalRateLimit(client, "groq_requests")).allowed, false);
  assert.deepEqual(calls[0], {
    name: "consume_global_rate_limit",
    args: { p_bucket: "groq_requests", p_window_seconds: 86_400 },
  });
});

test("the global AI budget fails closed on errors unless the migration is missing", async () => {
  const restore = quiet();
  try {
    const failed = fakeClient({ data: null, error: { code: "57014", message: "statement timeout" } });
    assert.equal((await consumeGlobalRateLimit(failed.client, "groq_requests")).allowed, false);
    const thrown = fakeClient(new Error("network"));
    assert.equal((await consumeGlobalRateLimit(thrown.client, "groq_requests")).allowed, false);
    const missing = fakeClient({ data: null, error: { code: "PGRST202", message: "function not found" } });
    assert.equal((await consumeGlobalRateLimit(missing.client, "groq_requests")).allowed, true);
  } finally {
    restore();
  }
});

test("retry windows align to the fixed window boundary", () => {
  assert.equal(secondsUntilWindowEnds(3_600, 3_600_000 + 600_000), 3_000);
  assert.equal(secondsUntilWindowEnds(3_600, 7_200_000), 1);
});

test("rate limit messages state the limit and round the wait up to minutes", () => {
  assert.equal(
    rateLimitMessage("resume_parse", 61),
    "You've reached the limit of 10 resume uploads per hour. Try again in 2 minutes.",
  );
  assert.equal(
    rateLimitMessage("resume_scan", 30),
    "You've reached the limit of 30 scans per hour. Try again in 1 minute.",
  );
});
