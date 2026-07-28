import { describe, expect, it } from "vitest";
import { calculateExpectedBalance } from "@/lib/finance/cash";

describe("calculateExpectedBalance", () => {
  it("starts from the opening balance with no movements", () => {
    expect(calculateExpectedBalance("100.00", []).toString()).toBe("100");
  });

  it("adds SUPPLY movements to the balance", () => {
    const balance = calculateExpectedBalance("100", [{ type: "SUPPLY", amount: "50" }]);
    expect(balance.toString()).toBe("150");
  });

  it("adds SALE movements to the balance", () => {
    const balance = calculateExpectedBalance("0", [{ type: "SALE", amount: "80" }]);
    expect(balance.toString()).toBe("80");
  });

  it("adds ADJUSTMENT movements to the balance (treated as positive correction)", () => {
    const balance = calculateExpectedBalance("0", [{ type: "ADJUSTMENT", amount: "10" }]);
    expect(balance.toString()).toBe("10");
  });

  it("subtracts BLEED movements from the balance", () => {
    const balance = calculateExpectedBalance("100", [{ type: "BLEED", amount: "30" }]);
    expect(balance.toString()).toBe("70");
  });

  it("subtracts REFUND movements from the balance", () => {
    const balance = calculateExpectedBalance("100", [{ type: "REFUND", amount: "40" }]);
    expect(balance.toString()).toBe("60");
  });

  it("nets a SALE followed by an equal REFUND back to the opening balance", () => {
    const balance = calculateExpectedBalance("0", [
      { type: "SALE", amount: "140" },
      { type: "REFUND", amount: "140" },
    ]);
    expect(balance.toString()).toBe("0");
  });

  it("combines multiple movement types in order-independent sum", () => {
    const balance = calculateExpectedBalance("50", [
      { type: "SUPPLY", amount: "20" },
      { type: "SALE", amount: "100" },
      { type: "BLEED", amount: "30" },
      { type: "REFUND", amount: "10" },
      { type: "ADJUSTMENT", amount: "5" },
    ]);
    // 50 + 20 + 100 - 30 - 10 + 5 = 135
    expect(balance.toString()).toBe("135");
  });

  it("can go negative when bleeds/refunds exceed the balance", () => {
    const balance = calculateExpectedBalance("10", [{ type: "BLEED", amount: "25" }]);
    expect(balance.toString()).toBe("-15");
  });

  it("accepts Decimal-like opening balance and amounts consistently", () => {
    const balanceFromString = calculateExpectedBalance("99.99", [
      { type: "SALE", amount: "0.01" },
    ]);
    expect(balanceFromString.toString()).toBe("100");
  });
});
