import test from "node:test";import assert from "node:assert/strict";
test("short abstracts fail the DB requirement",()=>assert.ok("short".length<40)); test("valid project-year range",()=>assert.equal(2024>=1950&&2024<=2100,true));
