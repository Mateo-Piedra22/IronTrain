import { db } from '../db';

type TransactionRunner = <T>(fn: (trx: any) => Promise<T>) => Promise<T>;
let transactionSupportCache: boolean | null = null;
let lastTransactionBootstrapErrorMessage: string | null = null;
let lastTransactionBootstrapErrorAt: string | null = null;

function rememberBootstrapError(error: unknown): void {
    if (!(error instanceof Error)) return;
    const normalized = (error.message || 'unknown_error').trim();
    lastTransactionBootstrapErrorMessage = normalized.slice(0, 240);
    lastTransactionBootstrapErrorAt = new Date().toISOString();
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
        message.includes('transaction') ||
        isNeonHttpNoTransactionError(error)
    );
}

async function detectTransactionSupport(transaction: TransactionRunner): Promise<boolean> {
    if (transactionSupportCache !== null) return transactionSupportCache;
    try {
        await transaction(async (trx) => trx);
        transactionSupportCache = true;
    } catch (error) {
        if (isTransactionBootstrapError(error)) {
            rememberBootstrapError(error);
            transactionSupportCache = false;
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
        return fn(db as any);
    }
    const supportsNativeTransaction = await detectTransactionSupport(transaction);
    if (!supportsNativeTransaction) {
        return fn(db as any);
    }
    let callbackStarted = false;
    try {
        return await transaction(async (trx) => {
            callbackStarted = true;
            return fn(trx);
        });
    } catch (error) {
        if (!callbackStarted && isTransactionBootstrapError(error)) {
            rememberBootstrapError(error);
            transactionSupportCache = false;
            return fn(db as any);
        }
        throw error;
    }
}
