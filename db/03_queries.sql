-- DML uses labelled demo records only.
BEGIN; SELECT fn_upsert_paper_with_topics('Demo: Retrieval-Augmented Review Assistant','A labelled demonstration record for semantic literature discovery with citations.',2024,'Demo Systems Workshop',ARRAY['RAG','Information Retrieval'],NULL); COMMIT; -- actor is NULL because the seed creates no users (uploaded_by is nullable)
-- JOIN + GROUP BY + HAVING
SELECT t.name,COUNT(*) paper_count FROM topics t JOIN paper_topics pt USING(topic_id) JOIN papers p USING(paper_id) WHERE p.status='PUBLISHED' GROUP BY t.topic_id,t.name HAVING COUNT(*)>=2 ORDER BY paper_count DESC;
-- correlated query
SELECT p.title,p.citation_count FROM papers p WHERE p.citation_count>(SELECT AVG(p2.citation_count) FROM papers p2 WHERE p2.venue_id=p.venue_id);
-- nested query
SELECT DISTINCT a.full_name FROM authors a WHERE a.author_id IN (SELECT pa.author_id FROM paper_authors pa WHERE pa.paper_id IN (SELECT pt.paper_id FROM paper_topics pt JOIN topics t ON t.topic_id=pt.topic_id WHERE t.name='RAG'));
-- pgvector similarity (replace $1 with a real 768-dim query embedding)
SELECT p.title,1-(c.embedding <=> $1::vector) cosine_similarity FROM paper_chunks c JOIN papers p USING(paper_id) WHERE c.embedding IS NOT NULL ORDER BY c.embedding <=> $1::vector LIMIT 10;
