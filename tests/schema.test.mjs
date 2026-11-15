import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../db/scholarhub_schema.sql',import.meta.url),'utf8');
test('schema defines all three documented roles',()=>{for(const role of ['ADMIN','AUTHOR','REVIEWER'])assert.match(sql,new RegExp(`'${role}'`));});
test('schema includes paper workflow and review constraints',()=>{for(const value of ['SUBMITTED','UNDER_REVIEW','ACCEPTED','REJECTED','WITHDRAWN','MINOR_REVISION','MAJOR_REVISION'])assert.ok(sql.includes(value));});
test('schema includes full-text and vector search structures',()=>{assert.match(sql,/USING GIN\(search_vector\)/);assert.match(sql,/VECTOR\(384\)/);assert.match(sql,/ivfflat/);});
test('schema includes advanced DBMS objects',()=>{for(const value of ['CREATE OR REPLACE VIEW reviewer_workload','CREATE OR REPLACE FUNCTION avg_review_score','submit_paper_with_reviewers','trg_status_audit','trg_review_completion'])assert.ok(sql.includes(value));});
