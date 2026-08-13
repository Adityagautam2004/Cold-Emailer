import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "./api-errors";

const mockAuth = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("./auth", () => ({ auth: () => mockAuth() }));
vi.mock("@dispatch/db", () => ({ prisma: { user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } } }));

const { requireUser, requireUserWithTos } = await import("./require-user");

describe("requireUser", () => {
  it("throws UnauthorizedError when there is no session — the guarantee every API route relies on for its 401", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedError when the session's user id has no matching row (e.g. deleted account)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "ghost" } });
    mockFindUnique.mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns the user when a valid session resolves to a real row", async () => {
    const row = {
      id: "u1",
      email: "a@x.com",
      name: "A",
      timezone: "Asia/Kolkata",
      college: null,
      acceptedTosAt: null,
    };
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValueOnce(row);
    await expect(requireUser()).resolves.toEqual(row);
  });
});

describe("requireUserWithTos", () => {
  it("throws UnauthorizedError if the user hasn't accepted the ToS yet", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValueOnce({
      id: "u1",
      email: "a@x.com",
      name: "A",
      timezone: "Asia/Kolkata",
      college: null,
      acceptedTosAt: null,
    });
    await expect(requireUserWithTos()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("passes once acceptedTosAt is set", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValueOnce({
      id: "u1",
      email: "a@x.com",
      name: "A",
      timezone: "Asia/Kolkata",
      college: null,
      acceptedTosAt: new Date(),
    });
    await expect(requireUserWithTos()).resolves.toMatchObject({ id: "u1" });
  });
});
