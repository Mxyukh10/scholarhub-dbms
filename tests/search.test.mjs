import test from "node:test";
import assert from "node:assert/strict";
import { lexicalSearch, parseVector, words } from "../lib/search.ts";

const papers = [
  { id: 1, title: "Retrieval Assistant", abstract: "Finds relevant paper chunks.", year: 2024, venue: "V1", citations: 1, authors: ["A"], topics: ["RAG"] },
  { id: 2, title: "Transformer Comparison", abstract: "Compares attention variants.", year: 2023, venue: "V2", citations: 2, authors: ["B"], topics: ["Transformers"] },
];

test("words ignores short tokens and is case-insensitive", () => {
  assert.deepEqual([...words("The RAG of AI")].sort(), ["rag", "the"]);
});

test("lexicalSearch ranks matching papers and drops non-matches", () => {
  const r = lexicalSearch("retrieval chunks", papers);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 1);
  assert.equal(r[0].score, 1);
});

test("lexicalSearch returns nothing when no word matches", () => {
  assert.deepEqual(lexicalSearch("quantum", papers), []);
});

test("parseVector accepts a vector of the right size", () => {
  const raw = JSON.stringify(Array(768).fill(0.5));
  assert.equal(parseVector(raw)?.startsWith("[0.5,"), true);
});

test("parseVector rejects wrong size, junk and null", () => {
  assert.equal(parseVector("[0,0,0]"), null);
  assert.equal(parseVector("not json"), null);
  assert.equal(parseVector(null), null);
  assert.equal(parseVector(JSON.stringify(Array(768).fill("x"))), null);
});
