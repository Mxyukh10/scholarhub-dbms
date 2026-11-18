import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql=readFileSync(new URL('../db/scholarhub_schema.sql',import.meta.url),'utf8');
test('schema defines all three documented roles',()=>{for(const role of ['ADMIN','AUTHOR','REVIEWER'])assert.match(sql,new RegExp(`'${role}'`));});
test('schema includes paper workflow and review constraints',()=>{for(const value of ['SUBMITTED','UNDER_REVIEW','ACCEPTED','REJECTED','WITHDRAWN','MINOR_REVISION','MAJOR_REVISION'])assert.ok(sql.includes(value));});
test('schema includes full-text and vector search structures',()=>{assert.match(sql,/USING GIN\(search_vector\)/);assert.match(sql,/VECTOR\(384\)/);assert.match(sql,/ivfflat/);});
test('schema includes advanced DBMS objects',()=>{for(const value of ['CREATE OR REPLACE VIEW reviewer_workload','CREATE OR REPLACE FUNCTION avg_review_score','submit_paper_with_reviewers','trg_status_audit','trg_review_completion'])assert.ok(sql.includes(value));});

const assignmentRoute=readFileSync(new URL('../app/api/assignments/route.ts',import.meta.url),'utf8');
const papersRoute=readFileSync(new URL('../app/api/papers/route.ts',import.meta.url),'utf8');
const deleteRoute=readFileSync(new URL('../app/api/papers/[id]/route.ts',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../components/dashboard.tsx',import.meta.url),'utf8');
test('paper APIs expose average review score for role dashboards',()=>{assert.match(papersRoute,/NULLIF\(avg_review_score\(p\.paper_id\),0\) AS average_score/);assert.match(assignmentRoute,/NULLIF\(avg_review_score\(p\.paper_id\),0\) AS average_score/);assert.match(dashboard,/score-badge/);});
test('reviewer assignment API enforces a three-active-paper nested-query limit',()=>{assert.match(assignmentRoute,/SELECT COUNT\(\*\)::INTEGER AS active_count[\s\S]*SELECT DISTINCT ra\.paper_id/);assert.match(assignmentRoute,/REVIEWER_LIMIT_REACHED/);assert.match(assignmentRoute,/FOR UPDATE/);});
test('paper deletion is restricted to admins and deletes by paper id',()=>{assert.match(deleteRoute,/session\.role!==\"ADMIN\"/);assert.match(deleteRoute,/DELETE FROM papers WHERE paper_id=\$1 RETURNING/);assert.match(dashboard,/window\.confirm/);});
