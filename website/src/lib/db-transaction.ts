import { db } from '../db';

type TransactionRunner = <T>(fn: (trx: any) => Promise<T>) => Promise<T>;
let transactionSupportCache: boolean | null = null;

function isNeonHttpNoTransactionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.toLowerCase().includes('no transactions support in neon-http driver');
}

async function detectTransactionSupport(transaction: TransactionRunner): Promise<boolean> {
    if (transactionSupportCache !== null) return transactionSupportCache;
    try {
        await transaction(async (trx) => trx);
        transactionSupportCache = true;
    } catch (error) {
        if (isNeonHttpNoTransactionError(error)) {
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
        };
    }

    const supportsNativeTransaction = await detectTransactionSupport(transaction);
    return {
        hasTransactionMethod: true,
        supportsNativeTransaction,
        mode: supportsNativeTransaction ? ('native' as const) : ('fallback_db' as const),
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
    return transaction(fn);
}
