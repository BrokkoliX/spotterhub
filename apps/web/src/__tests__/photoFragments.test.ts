/**
 * Contract tests for the Photo GraphQL fragments.
 *
 * The split between PHOTO_CARD_FIELDS (feed/grid) and PHOTO_DETAIL_FIELDS
 * (single-photo page) is the central perf optimisation that eliminates the
 * similarAircraftPhotos N+1 cascade on the home feed. These tests lock the
 * boundary so a future contributor cannot quietly merge the heavy fields
 * back into the card fragment without explicitly updating the snapshot
 * here.
 *
 * If you legitimately need a new field on the home feed, add it to
 * PHOTO_CARD_FIELDS and update the expected lists below. If you find
 * yourself adding similarAircraftPhotos / exifData / fileSizeBytes /
 * mimeType / location / photographer / etc. to the card fragment to
 * "make a feature work", please re-read the comment block in
 * apps/web/src/lib/queries.ts and pull the data via a separate query
 * scoped to that feature instead — those fields are detail-page-only.
 */

import { describe, expect, it } from 'vitest';
import { print, type DocumentNode, type FragmentDefinitionNode } from 'graphql';

import { PHOTO_CARD_FIELDS, PHOTO_DETAIL_FIELDS } from '@/lib/queries';

/**
 * Walk a fragment AST and return the flat set of top-level field names
 * (i.e. fields directly on the Photo type, not nested selection sets).
 */
function topLevelFieldNames(doc: DocumentNode): Set<string> {
  const fragment = doc.definitions.find(
    (d): d is FragmentDefinitionNode => d.kind === 'FragmentDefinition',
  );
  if (!fragment) {
    throw new Error('Document does not contain a fragment definition');
  }
  const names = new Set<string>();
  for (const selection of fragment.selectionSet.selections) {
    if (selection.kind === 'Field') {
      names.add(selection.name.value);
    }
  }
  return names;
}

describe('PHOTO_CARD_FIELDS', () => {
  const fields = topLevelFieldNames(PHOTO_CARD_FIELDS);

  it('contains exactly the fields PhotoCard and PhotoGrid render', () => {
    // Sorted alphabetically for stable diffs.
    const expected = [
      'aircraft',
      'airline',
      'airportCode',
      'caption',
      'commentCount',
      'communityCategory',
      'createdAt',
      'gearBody',
      'gearLens',
      'id',
      'isLikedByMe',
      'kind',
      'likeCount',
      'operatorIcao',
      'originalHeight',
      'originalUrl',
      'originalWidth',
      'tags',
      'takenAt',
      'user',
      'variants',
    ];
    expect([...fields].sort()).toEqual(expected);
  });

  it('does not include detail-only fields that would re-introduce the N+1', () => {
    // The whole point of the split. similarAircraftPhotos is the killer:
    // its field resolver fires findMany + count per photo, so a 24-photo
    // feed page would otherwise trigger ~50 SQL queries.
    const forbidden = [
      'similarAircraftPhotos',
      'exifData',
      'fileSizeBytes',
      'mimeType',
      'license',
      'watermarkEnabled',
      'photoCategory',
      'aircraftSpecificCategory',
      'location',
      'photographer',
      'photographerName',
      'operatorType',
      'msn',
      'manufacturingDate',
      'moderationStatus',
      'rejectionReason',
    ];
    for (const field of forbidden) {
      expect(fields, `card fragment must not contain ${field}`).not.toContain(field);
    }
  });

  it('serialises to a string containing the expected fragment header', () => {
    // Smoke check that the fragment is well-formed and targets Photo.
    expect(print(PHOTO_CARD_FIELDS)).toMatch(/fragment PhotoCardFields on Photo/);
  });
});

describe('PHOTO_DETAIL_FIELDS', () => {
  it('extends PhotoCardFields and adds the detail-only fields', () => {
    const printed = print(PHOTO_DETAIL_FIELDS);
    // Spreads the card fragment so consumers of the detail fragment
    // automatically get every field a card consumer needs.
    expect(printed).toMatch(/\.\.\.PhotoCardFields/);
    // The big-payload fields the detail page actually needs.
    for (const field of [
      'similarAircraftPhotos',
      'exifData',
      'fileSizeBytes',
      'mimeType',
      'license',
      'watermarkEnabled',
      'photoCategory',
      'aircraftSpecificCategory',
      'location',
      'photographer',
      'photographerName',
      'operatorType',
      'msn',
      'manufacturingDate',
      'moderationStatus',
      'rejectionReason',
    ]) {
      expect(printed, `detail fragment must contain ${field}`).toContain(field);
    }
  });
});
