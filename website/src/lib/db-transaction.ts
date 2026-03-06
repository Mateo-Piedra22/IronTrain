import { sql } from 'drizzle-orm';
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

function isNeonHttpNoTransactionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.toLowerCase().includes('no transactions support in neon-http driver');
}

function isTransactionBootstrapError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
        message.includes("cannot read properties of undefined (reading 'session')") ||
        message.includes('cannot read properties of undefined (reading "session")') ||
        isNeonHttpNoTransactionError(error)
    );
}

async function detectTransactionSupport(transaction: TransactionRunner): Promise<boolean> {
    const cacheAgeMs = Date.now() - transactionSupportCheckedAt;
    if (transactionSupportCache !== null && cacheAgeMs < TRANSACTION_SUPPORT_CACHE_TTL_MS) return transactionSupportCache;
    try {
        await transaction(async (trx) => {
            await (trx as any).execute(sql`select 1`);
        });
        clearBootstrapError();
        transactionSupportCache = true;
        transactionSupportCheckedAt = Date.now();
    } catch (error) {
        if (isTransactionBootstrapError(error)) {
            rememberBootstrapError(error);
            transactionSupportCache = false;
            transactionSupportCheckedAt = Date.now();
        } else {
            throw error;
        }
    }
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
        transactionSupportCache = false;
        transactionSupportCheckedAt = Date.now();
        clearBootstrapError();
        return fn(db as any);
    }
    const supportsNativeTransaction = await detectTransactionSupport(transaction);
    if (!supportsNativeTransaction) {
        return fn(db as any);
    }
    let callbackStarted = false;
    try {
        const result = await transaction(async (trx) => {
            callbackStarted = true;
            return fn(trx);
        });
        clearBootstrapError();
        return result;
    } catch (error) {
        if (!callbackStarted && isTransactionBootstrapError(error)) {
            rememberBootstrapError(error);
            transactionSupportCache = false;
            transactionSupportCheckedAt = Date.now();
            return fn(db as any);
        }
        throw error;
    }
}
