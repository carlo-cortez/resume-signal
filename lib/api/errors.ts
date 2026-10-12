import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "PARSE_FAILED"
  | "PERSISTENCE_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function apiError(code: ApiErrorCode, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}
