import { describe, it, expect } from "vitest";
import { GET } from "../../../pages/api/auth/me";

describe("GET /api/auth/me", () => {
  it("returns 401 with a null payload when there is no session", async () => {
    const context = { locals: { isAuthenticated: false, user: null } };

    const response = await GET(context as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(body).toEqual({ error: "Not authenticated", data: null });
  });

  it("returns 401 when the auth flag is set but no user was resolved", async () => {
    const context = { locals: { isAuthenticated: true, user: null } };

    const response = await GET(context as any);

    expect(response.status).toBe(401);
  });

  it("returns the user from locals when authenticated", async () => {
    const user = {
      id: "user-1",
      googleId: "google-1",
      email: "user@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.png",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const context = { locals: { isAuthenticated: true, user } };

    const response = await GET(context as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(body).toEqual({ data: user });
  });
});
