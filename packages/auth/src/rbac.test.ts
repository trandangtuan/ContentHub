import { describe, expect, it } from "vitest";
import { hasRole, isOwnerOrRole } from "./rbac";

describe("hasRole", () => {
  it("allows equal or higher roles", () => {
    expect(hasRole("ADMIN", "MODERATOR")).toBe(true);
    expect(hasRole("CREATOR", "CREATOR")).toBe(true);
  });

  it("denies lower roles", () => {
    expect(hasRole("READER", "CREATOR")).toBe(false);
    expect(hasRole("MODERATOR", "ADMIN")).toBe(false);
  });
});

describe("isOwnerOrRole", () => {
  it("allows the resource owner regardless of role", () => {
    expect(isOwnerOrRole({ userId: "u1", ownerId: "u1", role: "READER", requiredRole: "ADMIN" })).toBe(true);
  });

  it("allows a sufficiently privileged non-owner", () => {
    expect(isOwnerOrRole({ userId: "u2", ownerId: "u1", role: "ADMIN", requiredRole: "MODERATOR" })).toBe(true);
  });

  it("denies an unprivileged non-owner", () => {
    expect(isOwnerOrRole({ userId: "u2", ownerId: "u1", role: "READER", requiredRole: "MODERATOR" })).toBe(false);
  });
});
