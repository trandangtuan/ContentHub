import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@contenthub/database";
import { createModerationReport, transitionReportStatus, InvalidReportTransitionError } from "./reports";

const prisma = new PrismaClient();
let reporterUserId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `reporter-${Date.now()}@contenthub.dev`, passwordHash: "x", displayName: "Reporter" },
  });
  reporterUserId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createModerationReport", () => {
  it("creates a report in OPEN status", async () => {
    const report = await createModerationReport(prisma, {
      reporterUserId,
      targetType: "CONTENT",
      targetId: "00000000-0000-0000-0000-000000000000",
      reason: "copyright",
    });
    expect(report.status).toBe("OPEN");
  });
});

describe("transitionReportStatus", () => {
  it("allows OPEN -> REVIEWING -> RESOLVED", async () => {
    const report = await createModerationReport(prisma, {
      reporterUserId,
      targetType: "COMMENT",
      targetId: "00000000-0000-0000-0000-000000000000",
      reason: "spam",
    });

    const reviewing = await transitionReportStatus(prisma, report.id, "REVIEWING");
    expect(reviewing.status).toBe("REVIEWING");

    const resolved = await transitionReportStatus(prisma, report.id, "RESOLVED");
    expect(resolved.status).toBe("RESOLVED");
  });

  it("rejects an invalid transition (RESOLVED is terminal)", async () => {
    const report = await createModerationReport(prisma, {
      reporterUserId,
      targetType: "USER",
      targetId: "00000000-0000-0000-0000-000000000000",
      reason: "harassment",
    });
    await transitionReportStatus(prisma, report.id, "REVIEWING");
    await transitionReportStatus(prisma, report.id, "RESOLVED");

    await expect(transitionReportStatus(prisma, report.id, "REVIEWING")).rejects.toThrow(InvalidReportTransitionError);
  });

  it("rejects skipping straight from OPEN to RESOLVED", async () => {
    const report = await createModerationReport(prisma, {
      reporterUserId,
      targetType: "CONTENT",
      targetId: "00000000-0000-0000-0000-000000000000",
      reason: "spam",
    });
    await expect(transitionReportStatus(prisma, report.id, "RESOLVED")).rejects.toThrow(InvalidReportTransitionError);
  });
});
