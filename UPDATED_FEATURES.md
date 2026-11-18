# ScholarHub – latest frontend and DBMS updates

## 1. Average review score on every role dashboard

The paper list now displays an `AVG SCORE` badge beside the paper status. The score is calculated from submitted review records through PostgreSQL's `avg_review_score(paper_id)` function. It is visible in the shared repository for Admin and Author, and in the Reviewer assignment list. Before the first review is submitted, the badge displays `—` rather than implying a score of zero. The paper detail page also displays the score beside the status.

## 2. Admin paper deletion

Admins see a Delete button on each paper in the repository. The UI asks for confirmation before calling `DELETE /api/papers/:id`. The API independently checks the session role and only permits ADMIN. Deleting the paper cascades to its assignments, reviews, paper-author links, paper-keyword links, audit rows and embedding row using the existing foreign-key `ON DELETE CASCADE` rules. Authors and reviewers cannot call this endpoint successfully.

## 3. Maximum of three active papers per reviewer

The Admin assignment API checks the reviewer workload with a nested SQL query that counts distinct papers where the review assignment is `PENDING` and the paper status is `SUBMITTED` or `UNDER_REVIEW`. The reviewer row is locked inside the transaction before checking and inserting, preventing concurrent Admin assignment requests from exceeding the limit for the same reviewer.

If the reviewer already has three active papers, the API returns HTTP 409 with code `REVIEWER_LIMIT_REACHED`. The Admin UI displays a popup explaining that the reviewer must finish at least one paper before another can be allocated.

A review is no longer counted as active after its assignment becomes `COMPLETED` (or `DECLINED`).

## Verification

Run the automated checks with:

```powershell
npm test
```

Then start PostgreSQL and the app using the normal project setup:

```powershell
docker compose up -d
npm run dev
```

The frontend is available at `http://localhost:3000`.
