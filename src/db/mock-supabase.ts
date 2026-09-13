import type { Database } from "./types";

/**
 * In-memory Supabase-compatible client for local development without an
 * external service. Enabled with USE_MOCK_DB=true.
 *
 * It implements only the query-builder subset the app actually uses:
 *   from(table)
 *     .select(cols, opts?) [.eq().order().eq()/.gte()/.lte().range()] [.single()]
 *     .insert(row).select().single()
 *     .update(patch).eq().select().single()
 *     .delete().eq().eq()
 *
 * Data lives in module scope, so it persists for the lifetime of the dev
 * server process (reset on restart). This is intentional local behaviour, not
 * a silent fallback: it is only active when the flag is set.
 */

type Row = Record<string, any>;

// Module-level stores shared across all mock client instances.
const stores: Record<string, Row[]> = {
  users: [],
  scans: [],
};

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Filter {
  op: "eq" | "gte" | "lte";
  column: string;
  value: unknown;
}

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((row) =>
    filters.every((f) => {
      if (f.op === "eq") return row[f.column] === f.value;
      if (f.op === "gte") return String(row[f.column]) >= String(f.value);
      if (f.op === "lte") return String(row[f.column]) <= String(f.value);
      return true;
    })
  );
}

class MockQuery implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rangeBounds: { from: number; to: number } | null = null;
  private wantCount = false;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | null = null;
  private returnSingle = false;

  constructor(private table: string) {}

  private get rows(): Row[] {
    if (!stores[this.table]) stores[this.table] = [];
    return stores[this.table];
  }

  select(_cols?: string, opts?: { count?: string }) {
    if (this.mode === "select" && opts?.count) this.wantCount = true;
    // For insert/update, select() just marks that we want the row back.
    return this;
  }

  insert(row: Row) {
    this.mode = "insert";
    this.payload = row;
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ op: "lte", column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  range(from: number, to: number) {
    this.rangeBounds = { from, to };
    return this;
  }

  single() {
    this.returnSingle = true;
    return this;
  }

  private execute(): { data: unknown; error: unknown; count?: number } {
    if (this.mode === "insert") {
      const now = new Date().toISOString();
      const record: Row = {
        id: this.payload?.id ?? uuid(),
        created_at: now,
        updated_at: now,
        ...this.payload,
      };
      this.rows.push(record);
      return { data: this.returnSingle ? record : [record], error: null };
    }

    if (this.mode === "update") {
      const matches = applyFilters(this.rows, this.filters);
      matches.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
      const result = matches[0] ?? null;
      if (this.returnSingle && !result) {
        return { data: null, error: { code: "PGRST116", message: "No rows returned" } };
      }
      return { data: this.returnSingle ? result : matches, error: null };
    }

    if (this.mode === "delete") {
      const matches = applyFilters(this.rows, this.filters);
      const store = this.rows;
      for (const row of matches) {
        const idx = store.indexOf(row);
        if (idx >= 0) store.splice(idx, 1);
      }
      return { data: null, error: null };
    }

    // select
    let result = applyFilters(this.rows, this.filters);
    const total = result.length;

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      result = [...result].sort((a, b) => {
        if (a[column] === b[column]) return 0;
        const cmp = String(a[column]) < String(b[column]) ? -1 : 1;
        return ascending ? cmp : -cmp;
      });
    }

    if (this.rangeBounds) {
      result = result.slice(this.rangeBounds.from, this.rangeBounds.to + 1);
    }

    if (this.returnSingle) {
      const single = result[0] ?? null;
      if (!single) {
        return { data: null, error: { code: "PGRST116", message: "No rows returned" } };
      }
      return { data: single, error: null };
    }

    return { data: result, error: null, count: this.wantCount ? total : undefined };
  }

  // Thenable so `await query` works like the real Supabase builder.
  then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected) as PromiseLike<TResult1 | TResult2>;
    }
  }
}

export interface MockSupabaseClient {
  from(table: string): MockQuery;
}

/** Creates an in-memory client compatible with the subset of the API used here. */
export const createMockSupabaseClient = (): MockSupabaseClient => ({
  from: (table: string) => new MockQuery(table),
});

/** Clears all in-memory data (useful for tests). */
export const __resetMockDb = () => {
  stores.users = [];
  stores.scans = [];
};

export type { Database };
