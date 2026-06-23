SELECT 
  sr.id, 
  u.name as reviewer_name,
  sr.stage_id, 
  sd.slug as stage_slug,
  sr.submission_id,
  s.current_stage_id,
  csd.slug as current_stage_slug,
  s.status,
  sr.decision
FROM submission_reviewers sr
JOIN users u ON u.id = sr.user_id
JOIN stage_definitions sd ON sd.id = sr.stage_id
JOIN submissions s ON s.id = sr.submission_id
LEFT JOIN stage_definitions csd ON csd.id = s.current_stage_id
WHERE s.reference_number = 'RRP-2026-0001'
ORDER BY s.id, sr.stage_id;
