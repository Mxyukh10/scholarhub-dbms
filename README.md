# ScholarHub — Research Paper Repository & Peer-Review Management

A Next.js + PostgreSQL DBMS mini-project implementing three roles: **Admin, Author and Reviewer**. The main SQL schema is `db/scholarhub_schema.sql`; it is the single schema used by the application.

## Features

- Role-based sign-in (Admin, Author, Reviewer)
- Author paper submission with keywords and venue
- Admin reviewer assignment and reviewer directory
- Reviewer assignment inbox and scored review submission
- Automatic review completion and a simple final decision rule (average score >= 7 accepts; below 7 rejects)
- PostgreSQL full-text search (generated `tsvector` + GIN index)
- pgvector `VECTOR(384)` storage and IVFFlat cosine index for future semantic embedding integration
- Views: `accepted_papers`, `pending_review_summary`, `reviewer_workload`
- Stored functions: `avg_review_score`, `submit_paper_with_reviewers`
- Triggers: paper status audit and automatic paper decision after all assigned reviews complete
- Foreign keys, unique constraints, CHECK constraints, and parameterized SQL queries

## Requirements

- Node.js 20 or newer
- Docker Desktop (recommended) with Docker Compose
- Git (optional, for GitHub)

## Quick setup on Windows

1. Install and open **Docker Desktop**.
2. Open this project folder in VS Code.
3. In a terminal at the project root, start PostgreSQL:

   ```powershell
   docker compose up -d
   ```

   The container uses the `pgvector/pgvector:pg16` image. It creates database `scholarhub`, user `scholarhub`, password `scholarhub_local_pw`, and runs `db/scholarhub_schema.sql` automatically on the first start.

4. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Keep `.env.local` private; it is ignored by Git. For a classroom demo, the sample role passwords are:

   | Role | Email shown in DB | Password |
   |---|---|---|
   | Admin | admin@scholarhub.local | `Admin@123` |
   | Author | author@scholarhub.local | `Author@123` |
   | Reviewer 1 | reviewer1@scholarhub.local | `Reviewer@123` |
| Reviewer 2 | reviewer2@scholarhub.local | `Reviewer@123` |

   The login screen asks for a role, account email and the role password. Both reviewer accounts use the reviewer demo password. Change these before sharing the app outside your local demo.

5. Install dependencies and start Next.js:

   ```powershell
   npm install
   npm run dev
   ```

6. Open http://localhost:3000.

## Database management

- Check the container: `docker compose ps`
- View database logs: `docker compose logs -f db`
- Open PostgreSQL shell: `docker exec -it scholarhub-postgres psql -U scholarhub -d scholarhub`
- Stop database: `docker compose down`
- Stop and DELETE local database data: `docker compose down -v` (destructive; use only to reset the demo database)

The SQL initialization script runs only when the PostgreSQL data volume is first created. If you edit the schema and need a clean rebuild, run `docker compose down -v` followed by `docker compose up -d`.

## Useful SQL for the project demonstration

```sql
-- All submissions and their authors
SELECT p.paper_id,p.title,p.status,u.name AS author
FROM papers p JOIN users u ON u.user_id=p.primary_author_id;

-- Reviewer workload view
SELECT * FROM reviewer_workload;

-- Accepted papers view
SELECT * FROM accepted_papers;

-- Average review score for a paper
SELECT avg_review_score(1);

-- Full-text search (uses the GIN index)
SELECT paper_id,title FROM papers
WHERE search_vector @@ plainto_tsquery('english','machine learning');

-- Audit trail
SELECT * FROM audit_log ORDER BY changed_at DESC;
```

## Important notes / remaining academic work

- The current login is a **local classroom demo login**: role passwords are read from `.env.local`; user roles and IDs are read from PostgreSQL. For production, replace this with per-user password hashing and account registration/reset.
- The paper decision rule is deliberately simple for demonstration. Explain it to your instructor and change it if your team has a different decision policy.
- The application currently provides PostgreSQL full-text search. True semantic search needs a configured embedding generator that creates 384-dimensional vectors with the same model used for query embeddings. The database extension/table/index are ready, but no embedding API or model is bundled.
- Demo user names and venue labels are sample records. Replace them with your team's actual users and verified academic examples before final submission.
- `db/01_schema.sql`, `db/02_advanced.sql` and `db/04_seed.sql` are compatibility pointers kept to prevent accidentally running the earlier prototype schema. Use only `db/scholarhub_schema.sql` to initialize ScholarHub; `db/03_queries.sql` contains optional demonstration queries.
