-- CS and CSE are the same branch. CS is the canonical code; CSE is a legacy
-- alias that older roster imports and hand-typed event criteria introduced.
-- See the 2026-11-15 entry in docs/DECISIONS.md.
--
-- This migration only rewrites branch values. No row is inserted or deleted,
-- so every student, application, offer, and calendar entry keeps its id and
-- its relations.

-- One branch code to its canonical form. Only the CSE alias changes (matched
-- after trimming, case-insensitively); every other value passes through
-- untouched, so M.Tech/M.Sc branch names are not reshaped.
CREATE OR REPLACE FUNCTION canonical_branch(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE WHEN upper(btrim(value)) = 'CSE' THEN 'CS' ELSE value END
$$;

-- A branch list in canonical form, with the duplicate an alias leaves behind
-- (["CS", "CSE"] -> ["CS"]) removed and the original order kept.
CREATE OR REPLACE FUNCTION canonical_branch_list(list TEXT[]) RETURNS TEXT[]
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN list IS NULL THEN NULL
    ELSE COALESCE(
      (
        SELECT array_agg(branch ORDER BY first_position)
        FROM (
          SELECT canonical_branch(item) AS branch, min(position) AS first_position
          FROM unnest(list) WITH ORDINALITY AS t(item, position)
          GROUP BY canonical_branch(item)
        ) deduped
      ),
      ARRAY[]::TEXT[]
    )
  END
$$;

-- Existing records.
UPDATE "User"
SET "branch" = canonical_branch("branch")
WHERE upper(btrim("branch")) = 'CSE';

UPDATE "JobProfile"
SET "allowedBranches" = canonical_branch_list("allowedBranches")
WHERE EXISTS (SELECT 1 FROM unnest("allowedBranches") b WHERE upper(btrim(b)) = 'CSE');

UPDATE "CalendarEvent"
SET "targetBranches" = canonical_branch_list("targetBranches")
WHERE EXISTS (SELECT 1 FROM unnest("targetBranches") b WHERE upper(btrim(b)) = 'CSE');

-- Future records. The application normalizes at every write boundary; these
-- triggers are the backstop for writers that bypass it (the raw table browser
-- on the backend, psql, a future import script), so CSE cannot re-enter the
-- database as a separate branch.
CREATE OR REPLACE FUNCTION user_canonical_branch() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."branch" := canonical_branch(NEW."branch");
  RETURN NEW;
END
$$;

CREATE TRIGGER "User_canonical_branch"
BEFORE INSERT OR UPDATE OF "branch" ON "User"
FOR EACH ROW EXECUTE FUNCTION user_canonical_branch();

CREATE OR REPLACE FUNCTION job_profile_canonical_branches() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."allowedBranches" := canonical_branch_list(NEW."allowedBranches");
  RETURN NEW;
END
$$;

CREATE TRIGGER "JobProfile_canonical_branches"
BEFORE INSERT OR UPDATE OF "allowedBranches" ON "JobProfile"
FOR EACH ROW EXECUTE FUNCTION job_profile_canonical_branches();

CREATE OR REPLACE FUNCTION calendar_event_canonical_branches() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW."targetBranches" := canonical_branch_list(NEW."targetBranches");
  RETURN NEW;
END
$$;

CREATE TRIGGER "CalendarEvent_canonical_branches"
BEFORE INSERT OR UPDATE OF "targetBranches" ON "CalendarEvent"
FOR EACH ROW EXECUTE FUNCTION calendar_event_canonical_branches();
