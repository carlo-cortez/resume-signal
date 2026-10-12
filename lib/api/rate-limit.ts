import type { SupabaseClient } from "@supabase/supabase-js";

export const RATE_LIMITS = {
  resume_parse: { limit: 10, windowSeconds: 3_600, label: "resume uploads" },
  resume_scan: { limit: 30, windowSeconds: 3_600, label: "scans" },
  groq_requests: { limit: 300, windowSeconds: 86_400, label: "AI requests" },
} as const;

export type UserRateLimitBucket = "resume_parse" | "resume_scan";
export type GlobalRateLimitBucket = "groq_requests";
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
type RateLimitClient = Pick<SupabaseClient, "rpc">;

// PostgREST and Postgres codes for "function does not exist", i.e. the
// rate-limit migration has not been applied to this project yet.
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

export function secondsUntilWindowEnds(windowSeconds: number, now = Date.now()) {
  const nowSeconds = now / 1000;
  const windowEnd = Math.ceil(nowSeconds / windowSeconds) * windowSeconds;
  return Math.max(1, Math.ceil(windowEnd - nowSeconds));
}

export function rateLimitMessage(bucket: UserRateLimitBucket, retryAfterSeconds: number) {
  const { limit, label } = RATE_LIMITS[bucket];
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `You've reached the limit of ${limit} ${label} per hour. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

async function consume(
  client: RateLimitClient,
  rpcName: string,
  bucket: UserRateLimitBucket | GlobalRateLimitBucket,
  allowOnError: (code: string | undefined) => boolean,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  let count: unknown;
  let errorCode: string | undefined;
  try {
    const { data, error } = await client.rpc(rpcName, { p_bucket: bucket, p_window_seconds: windowSeconds });
    count = data;
    if (error) {
      errorCode = error.code;
      console.error(`Rate limit check for ${bucket} failed: ${error.message}`);
    }
  } catch (error) {
    console.error(`Rate limit check for ${bucket} failed:`, error);
  }
  if (typeof count !== "number") {
    return { allowed: allowOnError(errorCode), retryAfterSeconds: 0 };
  }
  return count <= limit
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: secondsUntilWindowEnds(windowSeconds) };
}

// Per-user limits fail open so a database hiccup or a not-yet-applied
// migration never blocks uploads; the global AI budget is the cost backstop.
export function consumeUserRateLimit(client: RateLimitClient, bucket: UserRateLimitBucket) {
  return consume(client, "consume_user_rate_limit", bucket, () => true);
}

// The shared AI budget fails closed (the caller skips the model and uses the
// deterministic analysis) unless the migration simply has not been applied yet.
export function consumeGlobalRateLimit(client: RateLimitClient, bucket: GlobalRateLimitBucket) {
  return consume(
    client,
    "consume_global_rate_limit",
    bucket,
    (code) => code !== undefined && MISSING_FUNCTION_CODES.has(code),
  );
}
