import { describe, expect, it } from "vitest";
import { canTransitionAppointment } from "@/lib/domain/appointment-status";

describe("canTransitionAppointment", () => {
  it("rejects completing an already completed appointment", () => {
    expect(canTransitionAppointment("COMPLETED", "COMPLETED")).toBe(false);
    expect(canTransitionAppointment("COMPLETED", "CONFIRMED")).toBe(false);
    expect(canTransitionAppointment("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("allows valid transitions from SCHEDULED", () => {
    expect(canTransitionAppointment("SCHEDULED", "CONFIRMED")).toBe(true);
    expect(canTransitionAppointment("SCHEDULED", "COMPLETED")).toBe(true);
    expect(canTransitionAppointment("SCHEDULED", "CANCELLED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionAppointment("CANCELLED", "COMPLETED")).toBe(false);
    expect(canTransitionAppointment("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransitionAppointment("SCHEDULED", "SCHEDULED")).toBe(false);
  });

  it("allows reopen from NO_SHOW", () => {
    expect(canTransitionAppointment("NO_SHOW", "SCHEDULED")).toBe(true);
    expect(canTransitionAppointment("NO_SHOW", "CONFIRMED")).toBe(true);
  });
});
