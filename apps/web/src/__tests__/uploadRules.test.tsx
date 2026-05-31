import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { UploadRules } from '../components/UploadRules';

// These tests pin the moderation copy in place. The exact wording is part
// of the product surface — moderators reference rules by number, and the
// help articles link to specific rule headings — so silent edits should
// trip a test failure rather than slipping through unnoticed.

describe('UploadRules', () => {
  it('renders the panel heading and intro', () => {
    render(<UploadRules />);
    expect(
      screen.getByRole('heading', { name: /photo upload rules/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/all uploaded photos must follow the rules below/i),
    ).toBeInTheDocument();
  });

  it('renders all 13 numbered rule headings in order', () => {
    render(<UploadRules />);
    const ruleTitles = [
      'Aviation-related photos only',
      'Upload only your own photos',
      'Do not upload duplicate photos',
      'Avoid photo spam',
      'Required information must be provided',
      'Photo quality requirements',
      'Full-resolution uploads only',
      'No personal watermarks',
      'Backlit photos',
      'No visible faces',
      'Aircraft must be close and clear enough',
      'No basic airport photos',
      'Moderation decision',
    ];
    const renderedHeadings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(renderedHeadings).toEqual(ruleTitles);
  });

  it('renders the example sub-lists for the rules that include them', () => {
    render(<UploadRules />);
    // Rule 5 — required information examples
    expect(screen.getByText('Aircraft registration')).toBeInTheDocument();
    expect(screen.getByText('Date of photo')).toBeInTheDocument();
    // Rule 6 — quality rejection reasons
    expect(screen.getByText('Very blurry')).toBeInTheDocument();
    expect(screen.getByText('Too low in resolution')).toBeInTheDocument();
  });
});
