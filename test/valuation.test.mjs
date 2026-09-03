import test from "node:test";
import assert from "node:assert/strict";
import { calculateValuation, median, normalizeHomeType, numericValue } from "../server/valuation.mjs";

test("normalizes values and home type aliases", () => {
  assert.equal(numericValue("$1,250,000"), 1_250_000);
  assert.equal(normalizeHomeType("house"), "SINGLE_FAMILY");
  assert.equal(normalizeHomeType("townhome"), "TOWNHOUSE");
});

test("calculates the median for odd and even arrays", () => {
  assert.equal(median([4, 1, 8]), 4);
  assert.equal(median([10, 20, 30, 40]), 25);
});

test("filters comps by type and 70–130% square footage", () => {
  const property = {
    zpid: "100",
    address: { streetAddress: "1 Main St", city: "Austin", state: "TX", zipcode: "78701" },
    price: 500_000,
    zestimate: 480_000,
    livingArea: 2_000,
    homeType: "SINGLE_FAMILY",
  };
  const comps = [
    { zpid: "1", address: "A", unformattedPrice: 440_000, area: 2_000, homeType: "HOUSE" },
    { zpid: "2", address: "B", unformattedPrice: 525_000, area: 2_100, homeType: "SINGLE_FAMILY" },
    { zpid: "3", address: "C", unformattedPrice: 900_000, area: 3_000, homeType: "SINGLE_FAMILY" },
    { zpid: "4", address: "D", unformattedPrice: 400_000, area: 2_000, homeType: "CONDO" },
  ];

  const result = calculateValuation(property, comps);
  assert.equal(result.valuation.compCount, 2);
  assert.equal(result.comps.length, 2);
  assert.equal(result.valuation.medianPricePerSqft, 235);
  assert.equal(result.valuation.compValue, 470_000);
  assert.equal(result.valuation.fairValue, 476_000);
  assert.equal(result.valuation.rangeLow, 442_680);
  assert.ok(Math.abs(result.valuation.rangeHigh - 509_320) < 0.001);
  assert.equal(result.valuation.verdict, "Fair");
});
