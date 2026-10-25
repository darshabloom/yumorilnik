import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingTotalCents,
  canStartBooking,
  childReservedSeats,
  guestDetailsValid,
  reservedAdultSeats,
} from "../lib/bookingRules.ts";

test("family booking: only one child buys a reserved seat", () => {
  const assignments = { "A:1": "0", "A:2": "1", "A:3": "2" };
  assert.equal(reservedAdultSeats(2, assignments), 2);
  assert.equal(childReservedSeats(2, 2, assignments), 1);
  assert.equal(bookingTotalCents(2 * 3000, [10500, 10500, 10500]), 37500);
});

test("all named children must have a valid accompanying adult", () => {
  const guests = {
    "0": { name: "Parent", email: "parent@example.com", phone: "+64211234567" },
    "1": { name: "Child", email: "", phone: "" },
  };
  assert.equal(guestDetailsValid(1, 1, guests, { "1": "0" }), true);
  assert.equal(guestDetailsValid(1, 1, guests, { "1": "1" }), false);
  assert.equal(guestDetailsValid(1, 1, guests, {}), false);
  assert.equal(canStartBooking({ adults: 0, children: 1, other: 0 }), false);
});

test("pricing must reject unavailable or invalid seat prices", () => {
  assert.equal(bookingTotalCents(3000, [null]), null);
  assert.equal(bookingTotalCents(3000, [-1]), null);
  assert.equal(bookingTotalCents(3000, [10500.5]), null);
  assert.equal(bookingTotalCents(3000, [10500]), 13500);
});
