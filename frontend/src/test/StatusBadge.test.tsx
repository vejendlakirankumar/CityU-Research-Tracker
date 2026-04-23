/**
 * Tests for the StatusBadge component (defined inline in SubmissionsPage).
 * We extract the rendering logic here to avoid pulling in all the page's
 * network dependencies.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type SubmissionStatus,
} from '../types/submissions'

// ── Minimal reproduction of the StatusBadge from SubmissionsPage ─────────────

function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

describe('StatusBadge', () => {
  it('renders the human-readable label for DRAFT', () => {
    render(<StatusBadge status="DRAFT" />)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Draft')
  })

  it('renders the human-readable label for IN_REVIEW', () => {
    render(<StatusBadge status="IN_REVIEW" />)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('In Review')
  })

  it('renders the human-readable label for REVISION_REQUIRED', () => {
    render(<StatusBadge status="REVISION_REQUIRED" />)
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Revision Required')
  })

  it('renders PENDING_RELEASE with amber colour class', () => {
    render(<StatusBadge status="PENDING_RELEASE" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent('Pending Release')
    expect(badge.className).toContain('amber')
  })

  it('renders APPEAL_PENDING with rose colour class', () => {
    render(<StatusBadge status="APPEAL_PENDING" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent('Appeal Pending')
    expect(badge.className).toContain('rose')
  })

  it('renders ACCEPTED with green colour class', () => {
    render(<StatusBadge status="ACCEPTED" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent('Accepted')
    expect(badge.className).toContain('green')
  })

  it('renders REJECTED with red colour class', () => {
    render(<StatusBadge status="REJECTED" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent('Rejected')
    expect(badge.className).toContain('red')
  })

  it('renders WITHDRAWN without a vivid colour (uses grey)', () => {
    render(<StatusBadge status="WITHDRAWN" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge).toHaveTextContent('Withdrawn')
    expect(badge.className).toContain('gray')
  })
})
