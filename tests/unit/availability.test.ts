import { describe, expect, it } from "vitest";
import {
  hasConflict,
  intervalsOverlap,
  type OccupancyBlock,
} from "@/lib/domain/availability";

const base = new Date("2026-07-27T14:00:00.000Z");

function block(
  overrides: Partial<OccupancyBlock> & Pick<OccupancyBlock, "scheduledAt" | "duration">
): OccupancyBlock {
  return {
    status: "CONFIRMED",
    barberId: "barber-a",
    kind: "appointment",
    ...overrides,
  };
}

describe("intervalsOverlap", () => {
  it("detects exact overlap", () => {
    expect(intervalsOverlap(base, 30, base, 30)).toBe(true);
  });

  it("detects partial overlap", () => {
    const startB = new Date(base.getTime() + 15 * 60_000);
    expect(intervalsOverlap(base, 30, startB, 30)).toBe(true);
  });

  it("returns false when adjacent with no overlap", () => {
    const startB = new Date(base.getTime() + 30 * 60_000);
    expect(intervalsOverlap(base, 30, startB, 30)).toBe(false);
  });
});

describe("hasConflict", () => {
  const occupancy = [
    block({ scheduledAt: base, duration: 30, barberId: "barber-a" }),
  ];

  it("conflicts on exact same slot for same barber", () => {
    expect(
      hasConflict({
        start: base,
        duration: 30,
        barberId: "barber-a",
        occupancy,
      })
    ).toBe(true);
  });

  it("conflicts on partial overlap for same barber", () => {
    const partialStart = new Date(base.getTime() + 15 * 60_000);
    expect(
      hasConflict({
        start: partialStart,
        duration: 30,
        barberId: "barber-a",
        occupancy,
      })
    ).toBe(true);
  });

  it("allows different barbers at same time", () => {
    expect(
      hasConflict({
        start: base,
        duration: 30,
        barberId: "barber-b",
        occupancy,
      })
    ).toBe(false);
  });

  it("ignores cancelled appointments (slot freed)", () => {
    const cancelledOccupancy = [
      block({
        scheduledAt: base,
        duration: 30,
        barberId: "barber-a",
        status: "CANCELLED",
      }),
    ];

    expect(
      hasConflict({
        start: base,
        duration: 30,
        barberId: "barber-a",
        occupancy: cancelledOccupancy,
      })
    ).toBe(false);
  });
});
