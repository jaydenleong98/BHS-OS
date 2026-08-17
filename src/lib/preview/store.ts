/**
 * PREVIEW MODE ONLY — a tiny in-memory stand-in for Supabase.
 *
 * It implements exactly the slice of the PostgREST builder this app uses
 * (select/gte/lte/eq/in/order/maybeSingle, insert/upsert/update/delete) against
 * plain arrays, so every page — including the server actions on /entry and
 * /clients — behaves normally without a database behind it.
 *
 * Writes land in process memory and vanish on restart. That is the point: it is
 * a preview, not a local backend.
 */

import { buildDataset, type Dataset } from "./dataset";

type Row = Record<string, unknown>;
type Table = keyof Dataset;

// Survive Next's dev-server module reloads, so edits during a session don't
// silently reset data you just typed in.
const globalStore = globalThis as unknown as { __bhsPreviewData?: Dataset };

function store(): Dataset {
  if (!globalStore.__bhsPreviewData) globalStore.__bhsPreviewData = buildDataset();
  return globalStore.__bhsPreviewData;
}

function rowsOf(table: Table): Row[] {
  return store()[table] as unknown as Row[];
}

let insertSeq = 0;
const newId = () => `new-${Date.now().toString(36)}-${(++insertSeq).toString(36)}`;

type Filter = (row: Row) => boolean;

/** Applies `select("a, b, c")`. `*` and empty both mean the whole row. */
function project(row: Row, columns: string): Row {
  const trimmed = columns.trim();
  if (trimmed === "" || trimmed === "*") return { ...row };
  const keys = trimmed.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Row = {};
  for (const key of keys) out[key] = row[key];
  return out;
}

type Result<T> = { data: T; error: { message: string } | null };

class PreviewQuery implements PromiseLike<Result<Row[] | Row | null>> {
  private filters: Filter[] = [];
  private columns = "*";
  private sort: { column: string; ascending: boolean } | null = null;
  private mode: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row[] = [];
  private conflictKeys: string[] = [];
  private singleMode: "none" | "maybe" | "one" = "none";

  constructor(private table: Table) {}

  select(columns = "*") {
    // `.insert(...).select()` is a no-op for our purposes; only plain reads project.
    if (this.mode === "select") this.columns = columns;
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.conflictKeys = (options?.onConflict ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.payload = [patch];
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  gte(column: string, value: string | number) {
    this.filters.push((row) => (row[column] as string | number) >= value);
    return this;
  }

  lte(column: string, value: string | number) {
    this.filters.push((row) => (row[column] as string | number) <= value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending ?? true };
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  single() {
    this.singleMode = "one";
    return this;
  }

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }

  private run(): Result<Row[] | Row | null> {
    const rows = rowsOf(this.table);

    if (this.mode === "insert" || this.mode === "upsert") {
      for (const incoming of this.payload) {
        const existingIndex =
          this.mode === "upsert" && this.conflictKeys.length > 0
            ? rows.findIndex((row) => this.conflictKeys.every((k) => row[k] === incoming[k]))
            : -1;

        if (existingIndex >= 0) {
          rows[existingIndex] = { ...rows[existingIndex], ...incoming };
        } else {
          rows.push({
            id: newId(),
            created_at: new Date().toISOString(),
            ...incoming,
          });
        }
      }
      return { data: null, error: null };
    }

    if (this.mode === "update") {
      const patch = this.payload[0] ?? {};
      for (let i = 0; i < rows.length; i++) {
        if (this.matches(rows[i])) rows[i] = { ...rows[i], ...patch };
      }
      return { data: null, error: null };
    }

    if (this.mode === "delete") {
      const kept = rows.filter((row) => !this.matches(row));
      rows.length = 0;
      rows.push(...kept);
      return { data: null, error: null };
    }

    let selected = rows.filter((row) => this.matches(row));
    if (this.sort) {
      const { column, ascending } = this.sort;
      selected = [...selected].sort((a, b) => {
        const av = a[column] as string | number | null;
        const bv = b[column] as string | number | null;
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return (av < bv ? -1 : 1) * (ascending ? 1 : -1);
      });
    }

    const projected = selected.map((row) => project(row, this.columns));

    if (this.singleMode !== "none") {
      if (projected.length === 0) {
        return this.singleMode === "maybe"
          ? { data: null, error: null }
          : { data: null, error: { message: "No rows found" } };
      }
      return { data: projected[0], error: null };
    }

    return { data: projected, error: null };
  }

  then<TResult1 = Result<Row[] | Row | null>, TResult2 = never>(
    onfulfilled?:
      | ((value: Result<Row[] | Row | null>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

/** The single fake account preview mode signs you in as. */
export const PREVIEW_USER = {
  id: "preview-user",
  email: "preview@beyondhorizonsolutions.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date(0).toISOString(),
};

export function createPreviewClient() {
  return {
    from(table: string) {
      return new PreviewQuery(table as Table);
    },
    auth: {
      async getUser() {
        return { data: { user: PREVIEW_USER }, error: null };
      },
      async getSession() {
        return { data: { session: { user: PREVIEW_USER } }, error: null };
      },
      async signInWithPassword() {
        return { data: { user: PREVIEW_USER }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
}
