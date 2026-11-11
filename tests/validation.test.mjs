import test from "node:test";
import assert from "node:assert/strict";
import { paperInput } from "../lib/validation.ts";

const valid = {
  title: "A Study of Retrieval-Augmented Generation",
  abstract: "This abstract is comfortably longer than forty characters in total.",
  year: 2024,
  venue: "Demo Systems Workshop",
  topics: ["RAG", "NLP"],
};

test("a valid paper passes validation", () => {
  assert.equal(paperInput.safeParse(valid).success, true);
});

test("year is coerced from a string (HTML form input)", () => {
  const r = paperInput.safeParse({ ...valid, year: "2023" });
  assert.equal(r.success, true);
  assert.equal(r.data.year, 2023);
});

test("short abstracts are rejected (matches the DB CHECK of 40 chars)", () => {
  assert.equal(paperInput.safeParse({ ...valid, abstract: "too short" }).success, false);
});

test("short titles are rejected", () => {
  assert.equal(paperInput.safeParse({ ...valid, title: "Short" }).success, false);
});

test("year outside 1950..next year is rejected", () => {
  assert.equal(paperInput.safeParse({ ...valid, year: 1949 }).success, false);
  assert.equal(paperInput.safeParse({ ...valid, year: new Date().getFullYear() + 2 }).success, false);
});

test("at least one and at most eight topics are required", () => {
  assert.equal(paperInput.safeParse({ ...valid, topics: [] }).success, false);
  const nine = Array.from({ length: 9 }, (_, i) => `Topic ${i}`);
  assert.equal(paperInput.safeParse({ ...valid, topics: nine }).success, false);
});

test("missing venue is rejected", () => {
  const { venue, ...rest } = valid;
  assert.equal(paperInput.safeParse(rest).success, false);
});
