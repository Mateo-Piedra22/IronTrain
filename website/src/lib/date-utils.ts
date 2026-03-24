/**
 * Shared date utilities — previously duplicated in 3+ files.
 */

/**
 * Safely converts unknown values to an ISO 8601 string.
 * Returns null if the value cannot be parsed as a valid date.
 */
export function toIsoSafe(value: unknown): string | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

/**
 * Safely converts an unknown value to a Date object.
 * Returns null if invalid.
 */
export function toDateSafe(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}
