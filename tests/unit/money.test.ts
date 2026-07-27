import { describe, expect, it } from "vitest";
import {
  addCents,
  centsToDecimalString,
  formatBRLFromCents,
  fromCents,
  percentOfCents,
  toCents,
} from "@/lib/money";

describe("money cents rounding", () => {
  it("converts major units to cents with rounding", () => {
    expect(toCents(10.005)).toBe(1001);
    expect(toCents(10.004)).toBe(1000);
    expect(toCents("19.99")).toBe(1999);
  });

  it("converts cents back to major units", () => {
    expect(fromCents(1999)).toBe(19.99);
    expect(centsToDecimalString(1999)).toBe("19.99");
  });

  it("adds cents values", () => {
    expect(addCents(100, 250, 50)).toBe(400);
  });

  it("applies half-up percent rounding in cents", () => {
    expect(percentOfCents(1000, 33.33)).toBe(333);
    expect(percentOfCents(100, 12.5)).toBe(13);
  });

  it("formats BRL from cents", () => {
    expect(formatBRLFromCents(1999)).toContain("19,99");
  });

  it("throws on invalid monetary input", () => {
    expect(() => toCents(Number.NaN)).toThrow("Valor monetário inválido");
  });
});
