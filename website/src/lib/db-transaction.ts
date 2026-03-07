import { db } from '../db';

type TransactionRunner = <T>(fn: (trx: any) => Promise<T>) => Promise<T>;
let transactionSupportCache: boolean | null = null;
let transactionSupportCheckedAt = 0;
let lastTransactionBootstrapErrorMessage: string | null = null;
let lastTransactionBootstrapAt: string | null = null;
const TRANSACTION_SUPPORT_CACHE_TTL_MS = 60_000;

function rememberBootstrapError(error: unknown): void {
    if (!(error instanceof Error)) return;
    const normalized = (error.message || 'unknown_error').trim();
    lastTransactionBootstrapErrorMessage = normalized.slice(0, 240);
    lastTransactionBootstrapAt = new Date().toISOString();
}

function clearBootstrapError(): void {
    lastTransactionBootstrapErrorMessage = null;
    lastTransactionBootstrapAt = null;
}

async function detectTransactionSupport(): Promise<boolean> {
    const cacheAgeMs = Date.now() - transactionSupportCheckedAt;
    if (transactionSupportCache !== null && cacheAgeMs < TRANSACTION_SUPPORT_CACHE_TTL_MS) return transactionSupportCache;

    const hasTransactionMethod = typeof db.transaction === 'function';
    if (!hasTransactionMethod) {
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        return false;
    }

    try {
        // Attempt to run a dummy transaction to check for support
        // We use db.transaction directly to ensure 'this' context
        await db.transaction(async (trx: any) => {
            // Lightest possible operation: no-op is often enough to verify method contract
        });
        transactionSupportCache = true;
        transactionSupportCheckedAt = Date.now();
        clearBootstrapError();
        return true;
    } catch (error) {
        rememberBootstrapError(error);
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        return false;
    }
}

export async function getDbTransactionDiagnostics() {
    const hasTransactionMethod = typeof db.transaction === 'function';
    if (!hasTransactionMethod) {
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        clearBootstrapError();
        return {
            hasTransactionMethod: false,
            supportsNativeTransaction: false,
            mode: 'fallback_db' as const,
            lastBootstrapErrorMessage: lastTransactionBootstrapErrorMessage,
            lastBootstrapErrorAt: lastTransactionBootstrapAt,
        };
    }

    const supportsNativeTransaction = await detectTransactionSupport();

    return {
        hasTransactionMethod: true,
        supportsNativeTransaction,
        mode: supportsNativeTransaction ? ('native' as const) : ('fallback_db' as const),
        lastBootstrapErrorMessage: lastTransactionBootstrapErrorMessage,
        lastBootstrapErrorAt: lastTransactionBootstrapAt,
    };
}

export async function runDbTransaction<T>(fn: (trx: any) => Promise<T>): Promise<T> {
    const hasTransactionMethod = typeof db.transaction === 'function';
    if (!hasTransactionMethod) {
        rememberBootstrapError(new Error('Database transaction method unavailable'));
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        throw new Error('Database transaction method unavailable');
    }

    const supportsNativeTransaction = await detectTransactionSupport();
    if (!supportsNativeTransaction) {
        throw new Error('Native transaction support unavailable');
    }

    try {
        const result = await db.transaction(fn);
        clearBootstrapError();
        transactionSupportCache = true;
        transactionSupportCheckedAt = Date.now();
        return result;
    } catch (error) {
        rememberBootstrapError(error);
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        throw error;
    }
}
