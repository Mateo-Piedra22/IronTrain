import { NextResponse } from 'next/server';

/**
 * Centralized API response helpers.
 * Ensures consistent error shapes across all API routes.
 */
export function apiError(message: string, status: number): NextResponse {
    return NextResponse.json({ error: message }, { status });
}

export function apiOk<T>(data: T, status = 200): NextResponse {
    return NextResponse.json(data, { status });
}
