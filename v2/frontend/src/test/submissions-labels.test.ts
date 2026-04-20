/**
 * Tests for STATUS_LABELS and STATUS_COLORS lookup tables in submissions.ts.
 *
 * These are pure data-integrity tests — no rendering required.
 */
import { describe, it, expect } from 'vitest'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type SubmissionStatus,
} from '../types/submissions'

const ALL_STATUSES: SubmissionStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'AWAITING_REVIEWERS',
  'IN_REVIEW',
  'REVISION_REQUIRED',
  'PENDING_RELEASE',
  'ACCEPTED',
  'CONDITIONALLY_ACCEPTED',
  'REJECTED',
  'APPEAL_PENDING',
  'WITHDRAWN',
  'CANCELLED',
]

describe('STATUS_LABELS', () => {
  it('contains a non-empty label for every SubmissionStatus', () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_LABELS[status], `Missing label for ${status}`)
        .toBeTruthy()
      expect(typeof STATUS_LABELS[status]).toBe('string')
    }
  })

  it('has expected human-readable labels for key statuses', () => {
    expect(STATUS_LABELS['DRAFT']).toBe('Draft')
    expect(STATUS_LABELS['IN_REVIEW']).toBe('In Review')
    expect(STATUS_LABELS['REVISION_REQUIRED']).toBe('Revision Required')
    expect(STATUS_LABELS['PENDING_RELEASE']).toBe('Pending Release')
    expect(STATUS_LABELS['ACCEPTED']).toBe('Accepted')
    expect(STATUS_LABELS['CONDITIONALLY_ACCEPTED']).toBe('Conditionally Accepted')
    expect(STATUS_LABELS['REJECTED']).toBe('Rejected')
    expect(STATUS_LABELS['APPEAL_PENDING']).toBe('Appeal Pending')
  })

  it('covers exactly all known statuses without extras', () => {
    const keys = Object.keys(STATUS_LABELS) as SubmissionStatus[]
    expect(keys.sort()).toEqual([...ALL_STATUSES].sort())
  })
})

describe('STATUS_COLORS', () => {
  it('contains a Tailwind class string for every SubmissionStatus', () => {
    for (const status of ALL_STATUSES) {
      const cls = STATUS_COLORS[status]
      expect(cls, `Missing color for ${status}`).toBeTruthy()
      // Each entry should contain at least two Tailwind classes (bg-* and text-*)
      expect(cls.split(' ').length, `Expected multiple classes for ${status}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('uses distinct colours for terminal accepted vs rejected statuses', () => {
    const accepted  = STATUS_COLORS['ACCEPTED']
    const rejected  = STATUS_COLORS['REJECTED']
    const withdrawn = STATUS_COLORS['WITHDRAWN']

    // They should all differ so the user can visually distinguish them
    expect(accepted).not.toBe(rejected)
    expect(accepted).not.toBe(withdrawn)
  })

  it('PENDING_RELEASE uses amber styling', () => {
    expect(STATUS_COLORS['PENDING_RELEASE']).toContain('amber')
  })

  it('APPEAL_PENDING uses rose styling', () => {
    expect(STATUS_COLORS['APPEAL_PENDING']).toContain('rose')
  })
})
