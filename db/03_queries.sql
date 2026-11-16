-- Run these queries after initializing db/scholarhub_schema.sql.

-- 1. JOIN: submissions with their primary authors and venues
SELECT p.paper_id,p.title,p.status,u.name AS author,v.name AS venue
FROM papers p JOIN users u ON u.user_id=p.primary_author_id
LEFT JOIN venues v ON v.venue_id=p.venue_id ORDER BY p.submitted_at DESC;

-- 2. GROUP BY + HAVING: reviewer workload
SELECT u.name,COUNT(*) AS pending_assignments
FROM users u JOIN review_assignments ra ON ra.reviewer_id=u.user_id
WHERE u.role='REVIEWER' AND ra.status='PENDING'
GROUP BY u.user_id,u.name HAVING COUNT(*) >= 1;

-- 3. Stored function: average score for a paper
SELECT avg_review_score(1);

-- 4. Full-text search using the GIN index
SELECT paper_id,title FROM papers
WHERE search_vector @@ plainto_tsquery('english','machine learning');

-- 5. Audit log created by the status trigger
SELECT * FROM audit_log ORDER BY changed_at DESC;

-- 6. Reviewer workload view
SELECT * FROM reviewer_workload;

-- 7. Vector similarity (replace the example vector with a real 384-dimension embedding)
-- SELECT p.title,1-(e.embedding <=> '[...]'::vector) AS cosine_similarity
-- FROM paper_embeddings e JOIN papers p ON p.paper_id=e.paper_id
-- ORDER BY e.embedding <=> '[...]'::vector LIMIT 5;
