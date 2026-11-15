-- ScholarHub: PostgreSQL + pgvector schema
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT 'ENV_DEMO_AUTH',
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','AUTHOR','REVIEWER')),
  department VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS venues (
  venue_id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'CONFERENCE' CHECK (type IN ('CONFERENCE','JOURNAL','WORKSHOP')),
  submission_deadline DATE,
  review_deadline DATE,
  CHECK (review_deadline IS NULL OR submission_deadline IS NULL OR review_deadline >= submission_deadline)
);
CREATE TABLE IF NOT EXISTS papers (
  paper_id SERIAL PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  abstract TEXT NOT NULL CHECK (length(abstract) >= 40),
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','UNDER_REVIEW','ACCEPTED','REJECTED','WITHDRAWN')),
  primary_author_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  venue_id INTEGER REFERENCES venues(venue_id) ON DELETE SET NULL,
  plagiarism_score NUMERIC(5,2) CHECK (plagiarism_score BETWEEN 0 AND 100),
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,''))) STORED
);
CREATE TABLE IF NOT EXISTS paper_authors (
  paper_id INTEGER NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  author_order SMALLINT NOT NULL DEFAULT 1 CHECK (author_order > 0),
  PRIMARY KEY (paper_id,user_id), UNIQUE (paper_id,author_order)
);
CREATE TABLE IF NOT EXISTS keywords (keyword_id SERIAL PRIMARY KEY, keyword_text VARCHAR(80) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS paper_keywords (
  paper_id INTEGER NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  keyword_id INTEGER NOT NULL REFERENCES keywords(keyword_id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id,keyword_id)
);
CREATE TABLE IF NOT EXISTS review_assignments (
  assignment_id SERIAL PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','DECLINED')),
  UNIQUE (paper_id,reviewer_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  review_id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL UNIQUE REFERENCES review_assignments(assignment_id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
  recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('ACCEPT','MINOR_REVISION','MAJOR_REVISION','REJECT')),
  comments TEXT,
  reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message VARCHAR(300) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
  log_id SERIAL PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(paper_id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by INTEGER REFERENCES users(user_id),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS paper_embeddings (
  paper_id INTEGER PRIMARY KEY REFERENCES papers(paper_id) ON DELETE CASCADE,
  embedding VECTOR(384) NOT NULL,
  model_name VARCHAR(60) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_author ON papers(primary_author_id);
CREATE INDEX IF NOT EXISTS idx_assignments_reviewer ON review_assignments(reviewer_id,status);
CREATE INDEX IF NOT EXISTS idx_papers_fts ON papers USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_embeddings_ivf ON paper_embeddings USING ivfflat(embedding vector_cosine_ops) WITH (lists=100);

CREATE OR REPLACE VIEW accepted_papers AS
 SELECT p.paper_id,p.title,p.abstract,p.submitted_at,u.name AS author,v.name AS venue
 FROM papers p JOIN users u ON u.user_id=p.primary_author_id LEFT JOIN venues v ON v.venue_id=p.venue_id
 WHERE p.status='ACCEPTED';
CREATE OR REPLACE VIEW pending_review_summary AS
 SELECT p.paper_id,p.title,COUNT(ra.assignment_id) FILTER (WHERE ra.status='PENDING') AS pending_reviews,
        COUNT(ra.assignment_id) AS total_assignments
 FROM papers p LEFT JOIN review_assignments ra ON ra.paper_id=p.paper_id
 GROUP BY p.paper_id,p.title;
CREATE OR REPLACE VIEW reviewer_workload AS
 SELECT u.user_id,u.name,u.email,COUNT(ra.assignment_id) FILTER (WHERE ra.status='PENDING') AS pending_assignments,
        COUNT(ra.assignment_id) AS total_assignments
 FROM users u LEFT JOIN review_assignments ra ON ra.reviewer_id=u.user_id
 WHERE u.role='REVIEWER' GROUP BY u.user_id,u.name,u.email;

CREATE OR REPLACE FUNCTION avg_review_score(pid INTEGER) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
 SELECT COALESCE(ROUND(AVG(r.score),2),0) FROM reviews r JOIN review_assignments a ON a.assignment_id=r.assignment_id WHERE a.paper_id=pid;
$$;
CREATE OR REPLACE FUNCTION fn_status_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE actor_id INTEGER;
BEGIN
 actor_id := nullif(current_setting('app.user_id',true),'')::INTEGER;
 IF OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO audit_log(paper_id,old_status,new_status,changed_by)
  VALUES(NEW.paper_id,OLD.status,NEW.status,actor_id);
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_status_audit ON papers;
CREATE TRIGGER trg_status_audit AFTER UPDATE OF status ON papers FOR EACH ROW EXECUTE FUNCTION fn_status_audit();

-- Once every assigned reviewer has submitted a review, the demo decision rule is:
-- average score >= 7 => ACCEPTED; otherwise REJECTED. Admin can subsequently override status.
CREATE OR REPLACE FUNCTION fn_complete_review_workflow() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE pid INTEGER; pending_count INTEGER; total_count INTEGER; score_avg NUMERIC;
BEGIN
 SELECT paper_id INTO pid FROM review_assignments WHERE assignment_id=NEW.assignment_id;
 UPDATE review_assignments SET status='COMPLETED' WHERE assignment_id=NEW.assignment_id;
 SELECT COUNT(*) FILTER (WHERE status='PENDING'),COUNT(*) INTO pending_count,total_count
 FROM review_assignments WHERE paper_id=pid;
 IF total_count > 0 AND pending_count = 0 THEN
  SELECT avg_review_score(pid) INTO score_avg;
  UPDATE papers SET status=CASE WHEN score_avg >= 7 THEN 'ACCEPTED' ELSE 'REJECTED' END WHERE paper_id=pid AND status='UNDER_REVIEW';
  INSERT INTO notifications(user_id,message)
   SELECT primary_author_id,'All reviews are complete. Your paper status is now ' || CASE WHEN score_avg >= 7 THEN 'ACCEPTED' ELSE 'REJECTED' END || '.'
   FROM papers WHERE paper_id=pid;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_review_completion ON reviews;
CREATE TRIGGER trg_review_completion AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION fn_complete_review_workflow();

-- Atomic multi-table submission helper; reviewer assignment is part of the same transaction.
CREATE OR REPLACE FUNCTION submit_paper_with_reviewers(
 p_title VARCHAR, p_abstract TEXT, p_author_id INTEGER, p_venue_name VARCHAR,
 p_venue_type VARCHAR, p_keywords TEXT[], p_reviewer_ids INTEGER[]
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_venue_id INTEGER; v_paper_id INTEGER; v_keyword TEXT; v_keyword_id INTEGER; v_reviewer INTEGER;
BEGIN
 INSERT INTO venues(name,type) VALUES(p_venue_name,p_venue_type)
 ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING venue_id INTO v_venue_id;
 INSERT INTO papers(title,abstract,primary_author_id,venue_id,status)
 VALUES(p_title,p_abstract,p_author_id,v_venue_id,'SUBMITTED') RETURNING paper_id INTO v_paper_id;
 INSERT INTO paper_authors(paper_id,user_id,author_order) VALUES(v_paper_id,p_author_id,1);
 FOREACH v_keyword IN ARRAY coalesce(p_keywords,ARRAY[]::TEXT[]) LOOP
  INSERT INTO keywords(keyword_text) VALUES(trim(v_keyword)) ON CONFLICT(keyword_text) DO UPDATE SET keyword_text=EXCLUDED.keyword_text RETURNING keyword_id INTO v_keyword_id;
  INSERT INTO paper_keywords(paper_id,keyword_id) VALUES(v_paper_id,v_keyword_id) ON CONFLICT DO NOTHING;
 END LOOP;
 FOREACH v_reviewer IN ARRAY coalesce(p_reviewer_ids,ARRAY[]::INTEGER[]) LOOP
  INSERT INTO review_assignments(paper_id,reviewer_id) VALUES(v_paper_id,v_reviewer);
  INSERT INTO notifications(user_id,message) VALUES(v_reviewer,'You have been assigned to review: ' || p_title);
 END LOOP;
 IF cardinality(coalesce(p_reviewer_ids,ARRAY[]::INTEGER[])) > 0 THEN
  UPDATE papers SET status='UNDER_REVIEW' WHERE paper_id=v_paper_id;
 END IF;
 RETURN v_paper_id;
END; $$;

-- Demo users; passwords are checked against local environment variables by the API.
INSERT INTO users(name,email,role,department) VALUES
 ('ScholarHub Administrator','admin@scholarhub.local','ADMIN','Research Office'),
 ('Demo Author','author@scholarhub.local','AUTHOR','Computer Science'),
 ('Demo Reviewer One','reviewer1@scholarhub.local','REVIEWER','Computer Science'),
 ('Demo Reviewer Two','reviewer2@scholarhub.local','REVIEWER','Data Science')
ON CONFLICT(email) DO NOTHING;
INSERT INTO venues(name,type) VALUES ('Demo Systems Workshop','WORKSHOP'),('Demo AI Conference','CONFERENCE') ON CONFLICT(name) DO NOTHING;
INSERT INTO keywords(keyword_text) VALUES ('Artificial Intelligence'),('Cybersecurity'),('Machine Learning'),('Information Retrieval') ON CONFLICT(keyword_text) DO NOTHING;
