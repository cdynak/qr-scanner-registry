import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient, __resetMockDb } from "../../db/mock-supabase";

describe("mock Supabase client", () => {
  beforeEach(() => {
    __resetMockDb();
  });

  it("inserts and returns a single row with generated id/timestamps", async () => {
    const db = createMockSupabaseClient();
    const { data, error } = await db
      .from("scans")
      .insert({ user_id: "u1", content: "hello", scan_type: "qr", format: "Text" })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ user_id: "u1", content: "hello", scan_type: "qr" });
    expect((data as any).id).toBeTruthy();
    expect((data as any).created_at).toBeTruthy();
  });

  it("selects with eq filter and count", async () => {
    const db = createMockSupabaseClient();
    await db.from("scans").insert({ user_id: "u1", content: "a", scan_type: "qr" }).select().single();
    await db.from("scans").insert({ user_id: "u2", content: "b", scan_type: "qr" }).select().single();

    const { data, count } = await db
      .from("scans")
      .select("*", { count: "exact" })
      .eq("user_id", "u1")
      .order("scanned_at", { ascending: false })
      .range(0, 19);

    expect(Array.isArray(data)).toBe(true);
    expect((data as any[]).length).toBe(1);
    expect(count).toBe(1);
  });

  it("returns PGRST116 error for single() with no match", async () => {
    const db = createMockSupabaseClient();
    const { data, error } = await db.from("users").select("*").eq("google_id", "nope").single();

    expect(data).toBeNull();
    expect((error as any).code).toBe("PGRST116");
  });

  it("updates matching rows and returns the updated row", async () => {
    const db = createMockSupabaseClient();
    await db.from("users").insert({ google_id: "g1", email: "a@b.c", name: "Old" }).select().single();

    const { data } = await db.from("users").update({ name: "New" }).eq("google_id", "g1").select().single();

    expect((data as any).name).toBe("New");
  });

  it("deletes rows matching a double eq filter (id + user_id)", async () => {
    const db = createMockSupabaseClient();
    const { data: created } = await db
      .from("scans")
      .insert({ user_id: "u1", content: "x", scan_type: "qr" })
      .select()
      .single();
    const id = (created as any).id;

    const { error } = await db.from("scans").delete().eq("id", id).eq("user_id", "u1");
    expect(error).toBeNull();

    const { data } = await db.from("scans").select("*").eq("user_id", "u1").range(0, 19);
    expect((data as any[]).length).toBe(0);
  });
});

describe("mock Supabase client – query builder edge cases", () => {
  beforeEach(() => {
    __resetMockDb();
  });

  it("insert without single() returns an array and honours a caller-provided id", async () => {
    const db = createMockSupabaseClient();
    const { data, error } = await db.from("scans").insert({ id: "fixed-id", user_id: "u1", content: "a" }).select();

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect((data as any[])[0].id).toBe("fixed-id");
  });

  it("filters with gte/lte on ISO timestamps", async () => {
    const db = createMockSupabaseClient();
    await db.from("scans").insert({ user_id: "u1", content: "old", scanned_at: "2026-01-01T00:00:00.000Z" });
    await db.from("scans").insert({ user_id: "u1", content: "mid", scanned_at: "2026-06-01T00:00:00.000Z" });
    await db.from("scans").insert({ user_id: "u1", content: "new", scanned_at: "2026-12-01T00:00:00.000Z" });

    const { data } = await db
      .from("scans")
      .select("*")
      .gte("scanned_at", "2026-03-01T00:00:00.000Z")
      .lte("scanned_at", "2026-09-01T00:00:00.000Z");

    expect((data as any[]).map((r) => r.content)).toEqual(["mid"]);
  });

  it("orders ascending by default and keeps equal keys stable", async () => {
    const db = createMockSupabaseClient();
    await db.from("scans").insert({ user_id: "u1", content: "b", scanned_at: "2" });
    await db.from("scans").insert({ user_id: "u1", content: "a", scanned_at: "1" });
    await db.from("scans").insert({ user_id: "u1", content: "c", scanned_at: "2" });

    const { data, count } = await db.from("scans").select("*").order("scanned_at");

    expect((data as any[]).map((r) => r.content)).toEqual(["a", "b", "c"]);
    // count is only populated when requested via select(..., { count })
    expect(count).toBeUndefined();
  });

  it("update without a match returns PGRST116 for single() and an empty list otherwise", async () => {
    const db = createMockSupabaseClient();

    const single = await db.from("users").update({ name: "x" }).eq("google_id", "missing").select().single();
    expect(single.data).toBeNull();
    expect((single.error as any).code).toBe("PGRST116");

    const many = await db.from("users").update({ name: "x" }).eq("google_id", "missing").select();
    expect(many.error).toBeNull();
    expect(many.data).toEqual([]);
  });

  it("creates an empty store for tables it has not seen before", async () => {
    const db = createMockSupabaseClient();
    const { data, error } = await db.from("audit_log").select("*");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
