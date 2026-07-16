import postgres, { type Sql, type TransactionSql } from "postgres";
import type { HouseholdId } from "@hfj/contracts";

export class NeonConnection {
  readonly pooled: Sql;
  readonly direct: Sql;

  constructor(pooledUrl: string, directUrl: string) {
    this.pooled = postgres(pooledUrl, { max: 10, idle_timeout: 20, connect_timeout: 10, prepare: false });
    this.direct = postgres(directUrl, { max: 2, idle_timeout: 20, connect_timeout: 10 });
  }

  async health(): Promise<{ ready: boolean; detail: string }> {
    try {
      const result = await this.pooled<{ current_time: string }[]>`SELECT now()::text AS current_time`;
      return result[0]?.current_time === undefined ? { ready: false, detail: "empty response" } : { ready: true, detail: "reachable" };
    } catch (error) {
      return { ready: false, detail: error instanceof Error ? error.name : "connection failure" };
    }
  }

  /**
   * Holds a transaction-scoped advisory lock on the same checked-out connection
   * used by the callback. Session locks are unsafe through Neon's transaction pooler.
   */
  async withHouseholdTransaction<T>(householdId: HouseholdId, operation: (transaction: TransactionSql) => Promise<T>): Promise<T> {
    return await this.pooled.begin(async (transaction) => {
      await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${householdId}, 0))`;
      return await operation(transaction);
    }) as T;
  }

  async close(): Promise<void> { await Promise.all([this.pooled.end(), this.direct.end()]); }
}
