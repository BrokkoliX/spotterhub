# Plan: Aircraft Registration On-The-Fly + Moderation Queue

## Context

When users upload photos, they should be able to provide aircraft details even if the aircraft isn't in the database. Currently:
- Registration field is a typeahead search for existing aircraft only — no way to add new
- Manufacturer/family/variant exist as dropdowns in the Aircraft Details section but only link via `aircraftId`
- There's no way for regular users to create aircraft records — only admins can

The goal: make registration a required field with two paths:
1. **Select existing aircraft** from dropdown (current behavior)
2. **Enter new registration + aircraft details** which get submitted for admin approval before linking

---

## Implementation

### Step 1 — Database: Add `pending` status to Aircraft model

**`packages/db/prisma/schema.prisma`**:
```prisma
// Add to Aircraft model:
status     AircraftStatus @default(ACTIVE)
// where enum AircraftStatus { ACTIVE, PENDING_APPROVAL }
```

### Step 2 — GraphQL: Add mutations for pending aircraft lifecycle

**`apps/api/src/schema.ts`**:
- `createPendingAircraft(input!)` — any authenticated user
- `approveAircraft(aircraftId!)` — admin/moderator/superuser
- `rejectAircraft(aircraftId!)` — admin/superuser

**`apps/api/src/resolvers/aircraftResolvers.ts`**:
- `createPendingAircraft` — creates aircraft with `status: PENDING_APPROVAL`, returns the pending aircraft record
- `approveAircraft` — sets status to `ACTIVE`, also links any photos that referenced this aircraft by registration
- `rejectAircraft` — deletes the pending aircraft record

### Step 3 — Upload page: Two-path registration flow

**`apps/web/src/app/upload/page.tsx`**:

**Registration field behavior:**
- User types registration → typeahead dropdown shows matches from existing aircraft
- If matches found → user selects one, `aircraftId` is set, details auto-fill
- If no matches → show "Register as new aircraft" option below dropdown
- User clicks "Register as new" → Aircraft Details section expands/becomes visible with mandatory fields (registration is pre-filled from search)
- On photo submit: if user entered a new registration, call `createPendingAircraft` first, then create photo with `operatorIcao`, `msn`, `manufacturingDate`, `operatorType` filled from the form data

**Key UX change:** Registration field becomes required. Aircraft Details section is always visible when no existing aircraft is selected.

### Step 4 — Admin: Pending aircraft queue

**`apps/web/src/app/admin/page.tsx`** or new section:
- Tab/panel for "Pending Aircraft" showing all `status: PENDING_APPROVAL` records
- Each shows: registration, manufacturer, family, variant, airline, msn, submitted by
- Approve / Reject buttons
- On approve: aircraft becomes active, all photos with matching operatorIcao can be linked (or already are via the create flow storing data on the photo record itself)

### Step 5 — Photo detail page: Handle pending aircraft

If photo has `operatorIcao`, `msn`, etc. but no linked aircraft yet, show all metadata fields (already done in previous fix). Add note if aircraft is "pending approval."

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/db/prisma/schema.prisma` | Add `status` field to Aircraft model with enum |
| `apps/api/src/schema.ts` | Add `createPendingAircraft`, `approveAircraft`, `rejectAircraft` mutations |
| `apps/api/src/resolvers/aircraftResolvers.ts` | Implement the three new mutations |
| `apps/web/src/app/upload/page.tsx` | Show "register new" option when registration not found; always show Aircraft Details |
| `apps/web/src/lib/queries.ts` | Add the three new mutation queries |
| `apps/web/src/app/admin/page.tsx` | Add pending aircraft management section |
| `apps/web/src/app/photos/[id]/page.tsx` | Show "pending approval" note if aircraft data exists but not linked |

---

## Verification

1. Go to `/upload`, enter a registration that doesn't exist in the database
2. Fill in aircraft details (manufacturer, family, variant, airline, msn, manufacturingDate)
3. Submit photo — see confirmation message
4. Photo detail page shows all aircraft metadata (Operator, Type, MSN, Built, etc.) with no linked aircraft yet
5. Go to `/admin` — see pending aircraft in the list
6. Approve it — photo now shows the Aircraft Info section with all fields and follow buttons