import test from "node:test";
import assert from "node:assert/strict";
import {
  bookingReadyForReview,
  bookingTotalCents,
  changeNamedSeat,
  selectedTableCapacity,
  usesFullZoneSeatPricing,
} from "../lib/bookingRules.ts";

test("zone-full-seat pricing honours explicit model and legacy event settings", () => {
  assert.equal(usesFullZoneSeatPricing("assigned_seats", "individual_seats", "zone_full_seat", 0), true);
  assert.equal(usesFullZoneSeatPricing("assigned_seats", "individual_seats", "admission_plus_seat", 3), false);
  assert.equal(usesFullZoneSeatPricing("assigned_seats", "individual_seats", null, 3), true);
  assert.equal(usesFullZoneSeatPricing("general_admission", null, "zone_full_seat", 3), false);
  assert.equal(usesFullZoneSeatPricing("tables", "whole_table", "zone_full_seat", 3), false);
});

test("adult reassigning their own seat frees old seat without losing other assignments", () => {
  const original = { "A:1": "0", "A:2": "1" };
  const result = changeNamedSeat(original, "A:3", 0, 2, 1, "seats");
  assert.equal(result.outcome, "assigned");
  assert.deepEqual(result.assignments, { "A:2": "1", "A:3": "0" });
  assert.deepEqual(original, { "A:1": "0", "A:2": "1" });
});

test("an occupied seat cannot be silently taken from another adult", () => {
  const original = { "A:1": "0", "A:2": "1" };
  const result = changeNamedSeat(original, "A:2", 0, 2, 1, "seats");
  assert.equal(result.outcome, "occupied");
  assert.deepEqual(result.assignments, original);
  const removed = changeNamedSeat(original, "A:2", 1, 2, 1, "seats");
  assert.equal(removed.outcome, "removed");
  assert.deepEqual(removed.assignments, { "A:1": "0" });
});

test("child selection never overwrites an adult's reserved seat", () => {
  const original = { "A:1": "0", "A:2": "1" };
  const refused = changeNamedSeat(original, "A:2", 2, 2, 2, "children");
  assert.equal(refused.outcome, "occupied");
  const result = changeNamedSeat(original, "A:3", 2, 2, 2, "children");
  assert.deepEqual(result.assignments, { "A:1": "0", "A:2": "1", "A:3": "2" });
  assert.equal(changeNamedSeat(result.assignments, "A:4", 2, 2, 2, "seats").outcome, "invalid");
});

const tables = [
  { id: "A", is_active: true, seats_top: 2, seats_bottom: 2, seats_left: 0, seats_right: 0 },
  { id: "B", is_active: true, seats_top: 1, seats_bottom: 1, seats_left: 0, seats_right: 0 },
  { id: "C", is_active: false, seats_top: 10, seats_bottom: 0, seats_left: 0, seats_right: 0 },
];

test("whole-table capacity counts actual active seating places", () => {
  assert.equal(selectedTableCapacity(["A"], tables), 4);
  assert.equal(selectedTableCapacity(["A", "B"], tables), 6);
  assert.equal(selectedTableCapacity(["A", "C", "missing"], tables), 4);
});

test("whole-table review requires a selected and sufficiently large table", () => {
  const base = {
    ticketCount: 5, guestDetailsComplete: true, totalCents: 20000,
    generalAdmission: false, wholeTable: true, selectedCount: 1,
    tableCapacity: 4, adultCount: 5, assignedAdultSeats: 0,
    adultSeatsRequired: true, seatOverage: false,
  };
  assert.equal(bookingReadyForReview(base), false);
  assert.equal(bookingReadyForReview({ ...base, tableCapacity: 6 }), true);
  assert.equal(bookingReadyForReview({ ...base, tableCapacity: 6, selectedCount: 0 }), false);
});

test("named adult seats required for assigned seating, children remain optional", () => {
  const base = {
    ticketCount: 4, guestDetailsComplete: true, totalCents: 37500,
    generalAdmission: false, wholeTable: false, selectedCount: 3,
    tableCapacity: 0, adultCount: 2, assignedAdultSeats: 2,
    adultSeatsRequired: true, seatOverage: false,
  };
  assert.equal(bookingReadyForReview(base), true);
  assert.equal(bookingReadyForReview({ ...base, assignedAdultSeats: 1 }), false);
  assert.equal(bookingReadyForReview({ ...base, totalCents: null }), false);
  assert.equal(bookingReadyForReview({ ...base, seatOverage: true }), false);
});

test("general admission skips seat requirements and blocks invalid prices", () => {
  const base = {
    ticketCount: 2, guestDetailsComplete: true, totalCents: 6000,
    generalAdmission: true, wholeTable: false, selectedCount: 0,
    tableCapacity: 0, adultCount: 2, assignedAdultSeats: 0,
    adultSeatsRequired: true, seatOverage: false,
  };
  assert.equal(bookingReadyForReview(base), true);
  assert.equal(bookingReadyForReview({ ...base, totalCents: null }), false);
  assert.equal(bookingReadyForReview({ ...base, guestDetailsComplete: false }), false);
});

test("unknown, negative, fractional and unsafe total amounts are rejected", () => {
  assert.equal(bookingTotalCents(6000, [10500, 10500, 10500]), 37500);
  assert.equal(bookingTotalCents(6000, [null]), null);
  assert.equal(bookingTotalCents(6000, [-1]), null);
  assert.equal(bookingTotalCents(6000, [2.5]), null);
  assert.equal(bookingTotalCents(Number.MAX_SAFE_INTEGER, [1]), null);
});
