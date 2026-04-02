import { sql } from 'drizzle-orm';

type TransactionLike = {
    execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export async function lockSharedRoutineWorkspace(
    tx: TransactionLike,
    workspaceId: string,
): Promise<void> {
    await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('shared_routine_workspace'), hashtext(${workspaceId}))`,
    );
}
