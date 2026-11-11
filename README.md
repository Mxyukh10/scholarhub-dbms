# PaperLens

PaperLens is a DBMS Level 3 mini-project: an AI Research Paper Analysis and Discovery platform. It deliberately goes beyond CRUD by connecting structured scholarly metadata with semantic retrieval over document chunks.

## What is implemented

- Next.js user interface with paper catalogue, paper detail/comparison context, analytics, semantic-search endpoint, and demo fallback.
- PostgreSQL relational model for users, papers, authors, venues, topics, many-to-many authorship/topics, paper relationships and audit records.
- pgvector model for chunks and 768-dimension embeddings using cosine similarity and an HNSW index.
- Two roles: `ADMIN` and `RESEARCHER`. The included local sign-in issues an HTTP-only signed session. Database users store `password_hash`, never plaintext passwords.
- Validation in browser/API (`zod`) and database constraints. Parameterized queries protect against injection.
- Advanced DB features: HNSW/vector index and full-text index, analytics view, transactional paper ingestion, PL/pgSQL stored function, and audit trigger.

All visible records are explicitly labelled fictional demo data. The fallback search is lexical scoring, not AI. Real semantic search requires an embedding provider to convert the incoming text to the same 768-dimension model used for stored chunks; this repository does not pretend to call one without configuration.

## Setup

1. Install Node 20+ and PostgreSQL 16+ with the `pgvector` extension.
2. Copy `.env.example` to `.env.local`, set a long `AUTH_SECRET` and two demo passwords. Never commit `.env.local`.
3. Create a database and execute, in order: `db/01_schema.sql`, `db/02_advanced.sql`, `db/04_seed.sql`. `db/03_queries.sql` contains demonstration queries to run separately.
4. Run `npm install`, then `npm run dev`; visit `http://localhost:3000`.
5. To see API validation, sign in at `/login` then POST a paper JSON object to `/api/papers`. With no `DATABASE_URL`, the endpoint validates and returns a clearly marked non-persistent demo result.

6. `/api/search?q=...` has three modes: pgvector similarity (when a valid 768-dim `vector` parameter is supplied), PostgreSQL full-text search (database mode without a vector), and a lexical demo fallback (no database). `POST /api/auth/logout` clears the session cookie. `AUTH_SECRET` is mandatory in production.

## Data and retrieval approach

For a verified paper, split the abstract/full text into numbered chunks, generate embeddings using one declared model, store them in `paper_chunks.embedding`, and record `embedding_model`. A query follows the same embedding process, then uses `embedding <=> query_vector` (cosine distance). The query in `db/03_queries.sql` returns the nearest chunks. This preserves the relational source of truth while adding concept search that keyword matching misses.

## Database design at a glance

`users -> papers -> paper_chunks`; `papers <-> authors` through `paper_authors`; `papers <-> topics` through `paper_topics`; `papers -> venues`; and `papers <-> papers` through `paper_relationships`. `audit_log` records paper mutations.

## Test and demonstration checklist

Run `npm test` for basic checks and `npm run build` before demo day. In PostgreSQL, demonstrate invalid year/abstract rejection, duplicate title rejection, `fn_upsert_paper_with_topics` inside a transaction, `v_topic_year_analytics`, trigger-generated audit rows, full-text index query, and pgvector similarity query. Capture screenshots only after replacing demo records with a small, cited set of verified papers.

## Team placeholders

Primary student: Mayukh Pravin (PES2UG24CS271). Add the second member, guide, project approvals, actual GitHub repository URL, and individual contribution history before submission. Do not invent these details.
