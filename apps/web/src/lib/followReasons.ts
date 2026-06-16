import type { PhotoData } from '@/components/PhotoCard';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The shape of a `Follow` row as returned by the `myFollowing` GraphQL query.
 * Only the fields needed for reason computation are listed; extra fields
 * returned by the query (profile, followerCount, createdAt, etc.) are ignored.
 */
export interface FollowEntry {
  id: string;
  targetType: string;
  user: { id: string; username: string } | null;
  airport: { id: string; icaoCode: string; iataCode?: string | null; name?: string | null } | null;
  targetValue: string | null;
}

/**
 * Why a photo appears in the Following feed. Order in the union is the
 * display priority (highest first), enforced by `REASON_PRIORITY`.
 */
export type FollowReason =
  | { kind: 'user'; username: string }
  | { kind: 'airport'; icaoCode: string; name?: string | null }
  | { kind: 'manufacturer'; value: string }
  | { kind: 'family'; value: string }
  | { kind: 'variant'; value: string }
  | { kind: 'airline'; value: string }
  | { kind: 'registration'; value: string };

const REASON_PRIORITY: Record<FollowReason['kind'], number> = {
  user: 0,
  airport: 1,
  manufacturer: 2,
  family: 3,
  variant: 4,
  airline: 5,
  registration: 6,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Returns the short label used by both the "via X" chip and the
 * ManageFollowsSection rows. Lives here (not in the component) so both
 * consumers stay in lockstep.
 */
export function reasonLabel(reason: FollowReason): string {
  switch (reason.kind) {
    case 'user':
      return `@${reason.username}`;
    case 'airport':
      return reason.icaoCode;
    case 'manufacturer':
    case 'family':
    case 'variant':
    case 'airline':
    case 'registration':
      return reason.value;
  }
}

// ─── Reason Computation ─────────────────────────────────────────────────────

/**
 * Mirrors the matching logic in `apps/api/src/resolvers/followResolvers.ts`
 * (the `followingFeed` resolver). Each branch is intentionally a 1:1
 * transcription of the server's OR conditions so the "via X" chip is always
 * truthful about why the photo appears in the feed.
 *
 * `aircraft_type` is a valid value in the `Follow.targetType` enum but the
 * server's `followingFeed` does not consume it, so we skip it here too.
 *
 * Returns the matched reasons sorted by display priority
 * (user > airport > manufacturer > family > variant > airline > registration).
 * Multiple matches of the same kind collapse to one entry (e.g. two followed
 * manufacturers both matching the same photo just show the manufacturer name
 * once).
 */
export function getFollowReasons(
  photo: PhotoData,
  myFollowing: readonly FollowEntry[],
): FollowReason[] {
  const reasons: FollowReason[] = [];
  const seenKinds = new Set<FollowReason['kind']>();

  const pushIfNew = (reason: FollowReason) => {
    if (seenKinds.has(reason.kind)) return;
    seenKinds.add(reason.kind);
    reasons.push(reason);
  };

  // Index follows by targetType once.
  const userFollows = myFollowing.filter((f) => f.targetType === 'user' && f.user);
  const airportFollows = myFollowing.filter((f) => f.targetType === 'airport' && f.airport);
  const manufacturerFollows = myFollowing.filter(
    (f) => f.targetType === 'manufacturer' && f.targetValue,
  );
  const familyFollows = myFollowing.filter((f) => f.targetType === 'family' && f.targetValue);
  const variantFollows = myFollowing.filter((f) => f.targetType === 'variant' && f.targetValue);
  const airlineFollows = myFollowing.filter((f) => f.targetType === 'airline' && f.targetValue);
  const registrationFollows = myFollowing.filter(
    (f) => f.targetType === 'registration' && f.targetValue,
  );

  // ── User ────────────────────────────────────────────────────────────────
  if (userFollows.some((f) => f.user!.id === photo.user.id)) {
    // Pick the first follow whose user id matches — all matches are
    // equivalent for display purposes.
    const match = userFollows.find((f) => f.user!.id === photo.user.id)!;
    pushIfNew({ kind: 'user', username: match.user!.username });
  }

  // ── Airport (matches ICAO OR IATA, case-insensitive) ───────────────────
  const photoAirport = norm(photo.airportCode);
  if (photoAirport) {
    for (const f of airportFollows) {
      const a = f.airport!;
      if (norm(a.icaoCode) === photoAirport || norm(a.iataCode) === photoAirport) {
        pushIfNew({ kind: 'airport', icaoCode: a.icaoCode, name: a.name });
        break;
      }
    }
  }

  // ── Manufacturer / Family / Variant (case-insensitive) ─────────────────
  const photoManufacturer = norm(photo.aircraft?.manufacturer?.name);
  if (photoManufacturer) {
    for (const f of manufacturerFollows) {
      if (norm(f.targetValue) === photoManufacturer) {
        pushIfNew({ kind: 'manufacturer', value: f.targetValue! });
        break;
      }
    }
  }
  const photoFamily = norm(photo.aircraft?.family?.name);
  if (photoFamily) {
    for (const f of familyFollows) {
      if (norm(f.targetValue) === photoFamily) {
        pushIfNew({ kind: 'family', value: f.targetValue! });
        break;
      }
    }
  }
  const photoVariant = norm(photo.aircraft?.variant?.name);
  if (photoVariant) {
    for (const f of variantFollows) {
      if (norm(f.targetValue) === photoVariant) {
        pushIfNew({ kind: 'variant', value: f.targetValue! });
        break;
      }
    }
  }

  // ── Airline (matches photo.airline, aircraft.airline, or
  //    aircraft.airlineRef.icaoCode — case-insensitive) ─────────────────
  if (airlineFollows.length > 0) {
    const photoAirline = norm(photo.airline);
    // aircraft.airline is the free-text operator name on the aircraft row.
    // The GraphQL type doesn't include `airline` today, so we fall back to
    // the photo-level `airline` for the aircraft row path; this matches
    // the server's intent: a follow on "Delta Air Lines" should match a
    // photo with `airline: 'Delta Air Lines'`.
    const photoAircraftAirline = norm(photo.airline);
    const photoAirlineRef = norm(
      (photo.aircraft as { airlineRef?: { icaoCode?: string } } | null)?.airlineRef?.icaoCode,
    );

    for (const f of airlineFollows) {
      const v = norm(f.targetValue);
      if (
        (photoAirline && v === photoAirline) ||
        (photoAircraftAirline && v === photoAircraftAirline) ||
        (photoAirlineRef && v === photoAirlineRef)
      ) {
        pushIfNew({ kind: 'airline', value: f.targetValue! });
        break;
      }
    }
  }

  // ── Registration (case-insensitive) ────────────────────────────────────
  const photoReg = norm(photo.aircraft?.registration);
  if (photoReg) {
    for (const f of registrationFollows) {
      if (norm(f.targetValue) === photoReg) {
        pushIfNew({ kind: 'registration', value: f.targetValue! });
        break;
      }
    }
  }

  reasons.sort((a, b) => REASON_PRIORITY[a.kind] - REASON_PRIORITY[b.kind]);
  return reasons;
}
