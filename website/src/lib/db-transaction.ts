import { db } from '../db';

type TransactionRunner = <T>(fn: (trx: any) => Promise<T>) => Promise<T>;
let transactionSupportCache: boolean | null = null;
let transactionSupportCheckedAt = 0;
let lastTransactionBootstrapErrorMessage: string | null = null;
let lastTransactionBootstrapErrorAt: string | null = null;
const TRANSACTION_SUPPORT_CACHE_TTL_MS = 60_000;

function rememberBootstrapError(error: unknown): void {
    if (!(error instanceof Error)) return;
    const normalized = (error.message || 'unknown_error').trim();
    lastTransactionBootstrapErrorMessage = normalized.slice(0, 240);
    lastTransactionBootstrapErrorAt = new Date().toISOString();
}

function clearBootstrapError(): void {
    lastTransactionBootstrapErrorMessage = null;
    lastTransactionBootstrapErrorAt = null;
}

async function detectTransactionSupport(transaction: TransactionRunner): Promise<boolean> {
    const cacheAgeMs = Date.now() - transactionSupportCheckedAt;
    if (transactionSupportCache !== null && cacheAgeMs < TRANSACTION_SUPPORT_CACHE_TTL_MS) return transactionSupportCache;
    transactionSupportCache = true;
    transactionSupportCheckedAt = Date.now();
    return transactionSupportCache;
}

export async function getDbTransactionDiagnostics() {
    const transaction = (db as unknown as { transaction?: TransactionRunner }).transaction;
    if (typeof transaction !== 'function') {
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        clearBootstrapError();
        return {
            hasTransactionMethod: false,
            supportsNativeTransaction: false,
            mode: 'fallback_db' as const,
            lastBootstrapErrorMessage: lastTransactionBootstrapErrorMessage,
            lastBootstrapErrorAt: lastTransactionBootstrapErrorAt,
        };
    }

    const supportsNativeTransaction = await detectTransactionSupport(transaction);
    return {
        hasTransactionMethod: true,
        supportsNativeTransaction,
        mode: supportsNativeTransaction ? ('native' as const) : ('fallback_db' as const),
        lastBootstrapErrorMessage: lastTransactionBootstrapErrorMessage,
        lastBootstrapErrorAt: lastTransactionBootstrapErrorAt,
    };
}

export async function runDbTransaction<T>(fn: (trx: any) => Promise<T>): Promise<T> {
    const transaction = (db as unknown as { transaction?: TransactionRunner }).transaction;
    if (typeof transaction !== 'function') {
        rememberBootstrapError(new Error('Database transaction method unavailable'));
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        throw new Error('Database transaction method unavailable');
    }
    const supportsNativeTransaction = await detectTransactionSupport(transaction);
    if (!supportsNativeTransaction) {
        throw new Error('Native transaction support unavailable');
    }
    try {
        const result = await transaction(fn);
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
