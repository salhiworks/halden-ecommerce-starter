import { describe, expect, it } from "vitest";
import { decodeCartHandoff, encodeCartHandoff, MAX_CART_LINES, MAX_LINE_QUANTITY } from "./cart";

describe("cart hand-off (framed demo → checkout in a new tab)", () => {
  const lines = [
    { productId: "p-1", variantId: "v-1", quantity: 2 },
    { productId: "p-2", variantId: "v-9", quantity: 1 },
  ];

  it("round-trips ids and quantities through a URL", () => {
    const value = encodeCartHandoff(lines);
    const url = new URL(`https://store.example/checkout?bag=${encodeURIComponent(value)}`);
    expect(decodeCartHandoff(url.searchParams.get("bag"))).toEqual(lines);
  });

  it("carries nothing but ids and quantities", () => {
    expect(JSON.parse(encodeCartHandoff(lines))).toEqual([
      ["p-1", "v-1", 2],
      ["p-2", "v-9", 1],
    ]);
  });

  it("is untrusted input: anything malformed is no bag at all", () => {
    for (const value of [null, undefined, "", "not json", "{}", '"x"', "[[1,2,3]]", '[["p","",1]]', '[["p","v",0]]', "x".repeat(9000)]) {
      expect(decodeCartHandoff(value)).toEqual([]);
    }
  });

  it("is held to the bag's own limits", () => {
    expect(decodeCartHandoff('[["p","v",5000]]')).toEqual([{ productId: "p", variantId: "v", quantity: MAX_LINE_QUANTITY }]);
    const many = JSON.stringify(Array.from({ length: MAX_CART_LINES + 10 }, (_, i) => [`p${i}`, "v", 1]));
    expect(decodeCartHandoff(many)).toHaveLength(MAX_CART_LINES);
  });
});
