WITH first_pending AS (
  SELECT
    sr.submission_id,
    (ARRAY_AGG(sr.stage_id ORDER BY sd."order"))[1] AS stage_id
  FROM submission_reviewers sr
  JOIN stage_definitions sd ON sd.id = sr.stage_id
  JOIN submissions s ON s.id = sr.submission_id
  WHERE sr.status <> 'declined'
    AND sr.decision IS NULL
    AND s.status IN ('IN_REVIEW', 'AWAITING_REVIEWERS')
  GROUP BY sr.submission_id
)
UPDATE submissions s
SET
  current_stage_id = fp.stage_id,
  current_stage_entered_at = CASE
    WHEN s.current_stage_id IS DISTINCT FROM fp.stage_id THEN now()
    ELSE s.current_stage_entered_at
  END
FROM first_pending fp
WHERE s.id = fp.submission_id;

UPDATE submissions s
SET current_stage_id = NULL,
    current_stage_entered_at = NULL
WHERE s.status IN ('IN_REVIEW', 'AWAITING_REVIEWERS')
  AND NOT EXISTS (
    SELECT 1
    FROM submission_reviewers sr
    WHERE sr.submission_id = s.id
      AND sr.status <> 'declined'
      AND sr.decision IS NULL
  );
