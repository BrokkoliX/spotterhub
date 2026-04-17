# Plan: Aircraft & Photo Extended Fields

## Context

Users need richer aircraft and photo metadata:
- **Hierarchical aircraft identification**: Manufacturer → Family → Variant → Registration
- **Auto-fill**: pick a registration → all aircraft fields auto-populate; pick an airport ICAO → location data auto-fills; pick an operator ICAO → airline data auto-fills
- **Photo categories**: cabin, nightshot, accident, etc.
- **List management**: all lookup fields are user-contributable with admin approval notifications

**Decision: Two separate ICAO fields** — `airportIcao` (on `PhotoLocation`) and `operatorIcao` (on `Photo`) — to avoid ambiguity between airport and airline codes.

### Design Principles

1. **No denormalized airport/airline fields on Photo.** Airport metadata (IATA code, country, name) is accessed via `Photo → PhotoLocation → Airport` relations. Airline metadata is accessed via `Photo → Aircraft → Airline` or resolved at query time from `operatorIcao`. This avoids stale-data risk.
2. **No duplicated `serialNumber` on Photo.** MSN lives on `Aircraft` only. The frontend auto-fills it from the `Aircraft` relation for display, but it is not persisted on `Photo`.
3. **Categories are lookup tables, not enums.** `PhotoCategory` and `AircraftSpecificCategory` are models (not Prisma enums) so that admins can manage them at runtime without requiring a database migration.
4. **Location flexibility.** Photos can be shot at an airport (linked via `PhotoLocation.airportId`) or at any arbitrary location (set via map coordinates). When at an airport, airport metadata is resolved via the relation. When not at an airport, only coordinates and a `locationType` are relevant.

---

## 1. New Enums

```prisma
enum OperatorType {
  airline
  general_aviation
  military
  government
  cargo
  charter
  private
}
```

> **Note:** `PhotoCategory` and `AircraftSpecificCategory` are now **lookup tables** (see Section 2), not enums.

---

## 2. New Models

### Manufacturer
```prisma
model AircraftManufacturer {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique  // "Boeing"
  country   String?           // "United States"
  createdAt DateTime @default(now())

  families AircraftFamily[]
  @@map("aircraft_manufacturers")
}
```

### AircraftFamily
```prisma
model AircraftFamily {
  id            String   @id @default(uuid()) @db.Uuid
  name          String   @unique  // "757-200", "757-300"
  manufacturerId String  @map("manufacturer_id") @db.Uuid
  createdAt     DateTime @default(now())

  manufacturer AircraftManufacturer @relation(fields: [manufacturerId], references: [id])
  variants     AircraftVariant[]
  @@map("aircraft_families")
}
```

### AircraftVariant
```prisma
model AircraftVariant {
  id             String   @id @default(uuid()) @db.Uuid
  name           String   @unique  // "757-241PCF"
  familyId       String   @map("family_id") @db.Uuid
  aircraftTypeId String? @map("aircraft_type_id") @db.Uuid  // links to OpenFlights canonical type (has iata/icao codes)
  createdAt      DateTime @default(now())

  family       AircraftFamily @relation(fields: [familyId], references: [id])
  aircraftType AircraftType?  @relation(fields: [aircraftTypeId], references: [id], onDelete: SetNull)
  @@map("aircraft_variants")
}
```

### Airline
```prisma
model Airline {
  id        String   @id @default(uuid()) @db.Uuid
  name      String             // "American Airlines"
  icaoCode  String?  @unique   @map("icao_code")  // "AAL"
  iataCode  String?  @unique   @map("iata_code")  // "AA"
  country   String?
  callsign  String?            // "AMERICAN"
  createdAt DateTime @default(now())

  @@map("airlines")
}
```

### PhotoCategory (lookup table)
```prisma
model PhotoCategory {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique  // "cabin", "cockpit", "exterior", etc.
  label     String             // "Cabin", "Cockpit", "Exterior" (display name)
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  photos Photo[]
  @@map("photo_categories")
}
```

### AircraftSpecificCategory (lookup table)
```prisma
model AircraftSpecificCategory {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @unique  // "vintage", "narrowbody", etc.
  label     String             // "Vintage", "Narrowbody" (display name)
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  photos Photo[]
  @@map("aircraft_specific_categories")
}
```

### PendingListItem (for user-contributed list additions)

Each pending item targets a specific entity type. The `metadata` JSON schema is validated per `listType` in the resolver.

```prisma
model PendingListItem {
  id          String   @id @default(uuid()) @db.Uuid
  listType    String             // "manufacturer" | "family" | "variant" | "airline" | "photo_category" | "aircraft_specific_category"
  value       String             // the proposed new value (name)
  metadata    Json?              // extra fields, validated per listType (see below)
  submittedBy String             @map("submitted_by") @db.Uuid
  reviewedBy  String?            @map("reviewed_by") @db.Uuid
  status      String   @default("pending")  // "pending" | "approved" | "rejected"
  reviewNote  String?            @map("review_note")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt @map("updated_at")

  submitter User @relation("PendingListItemSubmitter", fields: [submittedBy], references: [id])
  reviewer  User? @relation("PendingListItemReviewer", fields: [reviewedBy], references: [id])
  @@map("pending_list_items")
}
```

**Metadata validation rules per `listType`** (enforced in resolver):

| `listType` | Required `metadata` fields | Optional `metadata` fields |
|---|---|---|
| `manufacturer` | — | `country: string` |
| `family` | `manufacturerId: uuid` | — |
| `variant` | `familyId: uuid` | `aircraftTypeId: uuid` |
| `airline` | — | `icaoCode: string`, `iataCode: string`, `country: string`, `callsign: string` |
| `photo_category` | — | `label: string` |
| `aircraft_specific_category` | — | `label: string` |

---

## 3. Extended Aircraft Model

```prisma
model Aircraft {
  // ... existing fields (registration, aircraftType, msn, airline, manufacturingDate) ...

  // New FKs:
  manufacturerId   String?      @map("manufacturer_id") @db.Uuid
  familyId         String?      @map("family_id") @db.Uuid
  variantId        String?      @map("variant_id") @db.Uuid
  operatorType     OperatorType? @map("operator_type")
  airlineId        String?      @map("airline_id") @db.Uuid

  // Relations:
  manufacturer AircraftManufacturer? @relation("RegisteredAircraftManufacturer", fields: [manufacturerId], references: [id], onDelete: SetNull)
  family       AircraftFamily?      @relation("RegisteredAircraftFamily", fields: [familyId], references: [id], onDelete: SetNull)
  variant      AircraftVariant?     @relation("RegisteredAircraftVariant", fields: [variantId], references: [id], onDelete: SetNull)
  airline      Airline?              @relation("RegisteredAirline", fields: [airlineId], references: [id], onDelete: SetNull)
}
```

**Auto-fill on registration selection:** When user picks a registration, the full Aircraft is fetched with all relations — manufacturer, family, variant, operatorType, airline, serialNumber (msn) all populate automatically in the form.

---

## 4. Extended Photo Model

```prisma
model Photo {
  // ... existing fields (aircraftId, aircraftTypeId, takenAt, gearBody, gearLens, etc.) ...

  // Aircraft linkage (existing):
  // aircraftId -> Aircraft (registration-level, which carries manufacturer/family/variant/airline/msn)
  // aircraftTypeId -> AircraftType (OpenFlights canonical type)

  // New fields:
  exifData                   Json?   @map("exif_data")  // full EXIF as JSON
  photoCategoryId            String? @map("photo_category_id") @db.Uuid
  aircraftSpecificCategoryId String? @map("aircraft_specific_category_id") @db.Uuid
  operatorIcao               String? @map("operator_icao")  // e.g. "AAL" — for quick airline lookup when no Aircraft record exists

  // Relations:
  photoCategory            PhotoCategory?            @relation(fields: [photoCategoryId], references: [id], onDelete: SetNull)
  aircraftSpecificCategory AircraftSpecificCategory? @relation(fields: [aircraftSpecificCategoryId], references: [id], onDelete: SetNull)
}
```

**Key design decisions:**
- **No `serialNumber` on Photo** — MSN is stored on `Aircraft` only, resolved via `Photo → Aircraft.msn`
- **No `airportIcao`, `iataCode`, `airportCountry` on Photo** — airport data is resolved via `Photo → PhotoLocation → Airport`
- **`operatorIcao` on Photo** — allows linking a photo to an operator even when no full `Aircraft` record exists yet. The frontend uses `airline(icaoCode)` query for auto-fill display, but does not persist denormalized airline fields.

---

## 5. Updated PhotoLocation

```prisma
model PhotoLocation {
  id                 String              @id @default(uuid()) @db.Uuid
  photoId            String              @unique @map("photo_id") @db.Uuid
  rawLatitude        Float?              @map("raw_latitude")     // optional — user may only know airport
  rawLongitude       Float?              @map("raw_longitude")
  displayLatitude    Float               @map("display_latitude")
  displayLongitude   Float               @map("display_longitude")
  privacyMode        LocationPrivacyMode @default(exact) @map("privacy_mode")
  airportId          String?             @map("airport_id") @db.Uuid
  spottingLocationId String?             @map("spotting_location_id") @db.Uuid
  locationType       String?             @map("location_type")  // "airport" | "museum" | "cemetery" | "airfield" | "other"
  country            String?             @map("country")        // resolved from coordinates or airport; useful for non-airport locations
  createdAt          DateTime            @default(now()) @map("created_at")
  updatedAt          DateTime            @updatedAt @map("updated_at")

  photo            Photo             @relation(fields: [photoId], references: [id], onDelete: Cascade)
  airport          Airport?          @relation(fields: [airportId], references: [id], onDelete: SetNull)
  spottingLocation SpottingLocation? @relation(fields: [spottingLocationId], references: [id], onDelete: SetNull)

  // Note: PostGIS geometry column and spatial index added via raw SQL migration
  @@map("photo_locations")
}
```

**Location scenarios:**
1. **At an airport**: User selects airport ICAO → `airportId` is set → `locationType = "airport"` → country, IATA code, coordinates all resolved via `Airport` relation.
2. **Not at an airport**: User places pin on map → `rawLatitude`/`rawLongitude` set → `country` resolved from reverse geocoding → `locationType` set manually (e.g., "museum", "other"). No `airportId`.

---

## 6. GraphQL Schema Changes

### New Types
```graphql
type AircraftManufacturer { id, name, country, families { id, name }, createdAt }
type AircraftFamily { id, name, manufacturer { id, name }, variants { id, name }, createdAt }
type AircraftVariant { id, name, family { id, name }, aircraftType { id, iataCode, icaoCode }, createdAt }
type Airline { id, name, icaoCode, iataCode, country, callsign, createdAt }
type PhotoCategory { id, name, label, sortOrder, createdAt }
type AircraftSpecificCategory { id, name, label, sortOrder, createdAt }
type PendingListItem { id, listType, value, metadata, status, reviewNote, createdAt, submitter { id, username }, reviewer { id, username } }

enum OperatorType { AIRLINE, GENERAL_AVIATION, MILITARY, GOVERNMENT, CARGO, CHARTER, PRIVATE }
```

### Updated CreatePhotoInput / UpdatePhotoInput
```graphql
input CreatePhotoInput {
  # ... existing fields (s3Key, mimeType, fileSizeBytes, caption, etc.) ...
  exifData?: JSON
  photoCategoryId?: ID
  aircraftSpecificCategoryId?: ID
  operatorIcao?: String
  # Existing: aircraftId (for registration), aircraftTypeId (OpenFlights type)
}
```

### Updated PhotoLocation types
```graphql
type PhotoLocation {
  # ... existing fields ...
  locationType: String
  country: String
  airport: Airport          # resolved from airportId FK
}

input PhotoLocationInput {
  # ... existing fields ...
  locationType: String
  airportIcao: String       # resolver looks up Airport by ICAO, sets airportId + derives display coordinates
}
```

### New Queries
```graphql
# Lookup lists (public, cached):
aircraftManufacturers(search?: String, first?: Int, after?: String): ManufacturerConnection!
aircraftFamilies(manufacturerId?: ID, search?: String, first?: Int, after?: String): FamilyConnection!
aircraftVariants(familyId?: ID, search?: String, first?: Int, after?: String): VariantConnection!
airlines(search?: String, first?: Int, after?: String): AirlineConnection!
photoCategories: [PhotoCategory!]!
aircraftSpecificCategories: [AircraftSpecificCategory!]!

# Admin only:
pendingListItems(status?: String, listType?: String, first?: Int, after?: String): PendingListItemConnection!

# Auto-fill queries:
aircraft(registration: String!): Aircraft  # already exists, returns full hierarchy
airport(icaoCode: String!): Airport        # for auto-fill
airline(icaoCode: String!): Airline        # for auto-fill
```

### New Mutations
```graphql
# List management (admin — requireAuth + requireRole(ADMIN)):
createManufacturer(input: { name: String!, country?: String }): AircraftManufacturer!
updateManufacturer(id: ID!, input: { name?: String, country?: String }): AircraftManufacturer!
deleteManufacturer(id: ID!): Boolean!

createFamily(input: { name: String!, manufacturerId: ID! }): AircraftFamily!
updateFamily(id: ID!, input: { name?: String, manufacturerId?: ID }): AircraftFamily!
deleteFamily(id: ID!): Boolean!

createVariant(input: { name: String!, familyId: ID!, aircraftTypeId?: ID }): AircraftVariant!
updateVariant(id: ID!, input: { name?: String, familyId?: ID, aircraftTypeId?: ID }): AircraftVariant!
deleteVariant(id: ID!): Boolean!

createAirline(input: { name: String!, icaoCode?: String, iataCode?: String, country?: String, callsign?: String }): Airline!
updateAirline(id: ID!, input: { name?: String, icaoCode?: String, iataCode?: String, country?: String, callsign?: String }): Airline!
deleteAirline(id: ID!): Boolean!

createPhotoCategory(input: { name: String!, label: String!, sortOrder?: Int }): PhotoCategory!
updatePhotoCategory(id: ID!, input: { name?: String, label?: String, sortOrder?: Int }): PhotoCategory!
deletePhotoCategory(id: ID!): Boolean!

createAircraftSpecificCategory(input: { name: String!, label: String!, sortOrder?: Int }): AircraftSpecificCategory!
updateAircraftSpecificCategory(id: ID!, input: { name?: String, label?: String, sortOrder?: Int }): AircraftSpecificCategory!
deleteAircraftSpecificCategory(id: ID!): Boolean!

# User contributions (requireAuth):
submitListItem(input: { listType: String!, value: String!, metadata?: JSON }): PendingListItem!

# Admin review (requireAuth + requireRole(ADMIN)):
reviewListItem(id: ID!, status: String!, reviewNote?: String): PendingListItem!
```

---

## 7. Auto-fill UX Flow

### Registration → Aircraft auto-fill
1. User starts typing in `registration` field → typeahead searches `Aircraft.registration`
2. User picks `N12345` from dropdown
3. GraphQL: `aircraft(registration: "N12345")` returns full Aircraft with manufacturer, family, variant, airline, msn loaded
4. Form auto-fills: manufacturer, family, variant, operatorType, airline, serialNumber (msn) — **displayed in form, not persisted on Photo**

### Airport ICAO → Location auto-fill
1. User types `KJFK` in airport ICAO field (part of location section)
2. GraphQL: `airport(icaoCode: "KJFK")` returns Airport with name, iataCode ("JFK"), country, lat/lng
3. Form auto-fills location fields: airport name, IATA code, country displayed in the form; `PhotoLocation.airportId` set to the Airport's ID; `locationType` set to `"airport"`; map centers on airport coordinates
4. If user also provides exact coordinates (pin on map), those override for `rawLatitude`/`rawLongitude`

### Operator ICAO → Airline auto-fill
1. User types `AAL` in `operatorIcao` field
2. GraphQL: `airline(icaoCode: "AAL")` returns Airline with name ("American Airlines"), callsign, iataCode ("AA"), country
3. Form displays airline info; `Photo.operatorIcao` is persisted for reference

### Non-airport location
1. User places pin on map → coordinates set directly
2. Reverse geocoding resolves `country` → stored on `PhotoLocation.country`
3. User selects `locationType` from dropdown ("museum", "cemetery", "airfield", "other")
4. No `airportId` is set

---

## 8. List Contribution & Admin Notification Flow

1. **User submits**: on photo upload/edit form (or dedicated UI), user enters a new value for any list field (manufacturer, family, variant, airline, photoCategory, aircraftSpecificCategory) that isn't in the dropdown
2. `submitListItem(listType, value, metadata)` mutation creates a `PendingListItem` with `status: "pending"`. Resolver validates `metadata` against the expected schema for the given `listType` (see Section 2 table)
3. **Admin notification**: mutation also creates `Notification` records for all admins: "New pending [listType]: [value] — submitted by [username]"
4. **Admin reviews** on `/admin/pending-list-items` page:
   - Approve → resolver creates the item in its target model (e.g., `AircraftManufacturer.create` with validated fields), sets `PendingListItem.status = "approved"`, `reviewedBy`, optional `reviewNote`
   - Reject → `status = "rejected"`, `reviewedBy`, `reviewNote`, notification sent to submitter

---

## 9. Auth & Permissions

| Operation | Required Role | Guard |
|---|---|---|
| `aircraftManufacturers`, `aircraftFamilies`, `aircraftVariants`, `airlines`, `photoCategories`, `aircraftSpecificCategories` | Public (authenticated) | `requireAuth` |
| `airport(icaoCode)`, `airline(icaoCode)`, `aircraft(registration)` | Public (authenticated) | `requireAuth` |
| `submitListItem` | Any authenticated user | `requireAuth` |
| `create/update/delete` Manufacturer, Family, Variant, Airline, PhotoCategory, AircraftSpecificCategory | Admin | `requireAuth` + `requireRole(ADMIN)` |
| `pendingListItems` (query) | Admin | `requireAuth` + `requireRole(ADMIN)` |
| `reviewListItem` | Admin | `requireAuth` + `requireRole(ADMIN)` |

---

## 10. Admin Pages to Add

| Page | New/Extend | Manages |
|------|-----------|---------|
| `/admin/pending-list-items` | **New** | `PendingListItem` — approve/reject for all list types |
| `/admin/manufacturers` | **New** | `AircraftManufacturer` — name, country |
| `/admin/families` | **New** | `AircraftFamily` — name, manufacturer (dropdown) |
| `/admin/variants` | **New** | `AircraftVariant` — name, family (dropdown), aircraftType (dropdown) |
| `/admin/airlines` | **New** | `Airline` — name, icaoCode, iataCode, country, callsign |
| `/admin/photo-categories` | **New** | `PhotoCategory` — name, label, sortOrder |
| `/admin/aircraft-specific-categories` | **New** | `AircraftSpecificCategory` — name, label, sortOrder |
| `/admin/aircraft` | Extend | Add columns: manufacturer, family, variant, operatorType, airline |
| Photo upload/edit | Extend | Add new fields: exifData, photoCategory, aircraftSpecificCategory, operatorIcao, locationType + auto-fill logic |

Each admin page follows the same pattern as `/admin/aircraft-types`:
- Cursor pagination, debounced search input
- Modal form for create/edit, inline delete with confirmation
- CSV export, CSV import (upsert by unique field)

---

## 11. Seed Data Strategy

### Data sources
| Entity | Source | Approximate count |
|---|---|---|
| `AircraftManufacturer` | Curated CSV (derived from OpenFlights `aircraft_types.vendor` + manual curation) | ~50–100 |
| `AircraftFamily` | Curated CSV (grouped from OpenFlights models) | ~200–400 |
| `AircraftVariant` | Curated CSV (detailed sub-models, linked to `AircraftType`) | ~500–1000 |
| `Airline` | OpenFlights `airlines.dat` (filtered to active airlines) | ~1000–2000 |
| `PhotoCategory` | Hardcoded seed (see below) | ~11 |
| `AircraftSpecificCategory` | Hardcoded seed (see below) | ~15 |

### Default PhotoCategory seed values
`cabin`, `cockpit`, `exterior`, `nightshot`, `landing`, `takeoff`, `ground`, `accident`, `museum`, `delivery`, `test_flight`

### Default AircraftSpecificCategory seed values
`vintage`, `classic`, `small_prop`, `regional_jet`, `narrowbody`, `widebody`, `cargo`, `military_transport`, `military_fighter`, `helicopter`, `ultralight`, `amphibious`, `seaplane`, `test_delivery`, `derivation`

### Seed script
- Extend `packages/db/prisma/seed.ts` (or add `seed-aircraft-hierarchy.ts`)
- Upsert by unique field (`name` for manufacturers/families/variants/categories, `icaoCode` for airlines)
- Idempotent — safe to re-run

---

## 12. Test Strategy

### API resolver tests (`apps/api/src/__tests__/`)

| Test file | Covers |
|---|---|
| `manufacturer.test.ts` | CRUD for `AircraftManufacturer`, search, pagination, admin auth guard |
| `family.test.ts` | CRUD for `AircraftFamily`, filtering by `manufacturerId`, admin auth guard |
| `variant.test.ts` | CRUD for `AircraftVariant`, filtering by `familyId`, admin auth guard |
| `airline.test.ts` | CRUD for `Airline`, `airline(icaoCode)` auto-fill query, admin auth guard |
| `pending-list-item.test.ts` | `submitListItem` (any user), `reviewListItem` (admin only), metadata validation per `listType`, notification creation on submit |
| `photo.test.ts` (extend) | New fields in `createPhoto`/`updatePhoto`, `operatorIcao` handling, category FK relations |
| `location.test.ts` (extend) | `airportIcao` → `airportId` resolution in `PhotoLocationInput`, non-airport location flow, `locationType` and `country` |

### Frontend tests (`apps/web/src/__tests__/`)
- Upload form: auto-fill flows (registration, airport ICAO, operator ICAO)
- Admin pages: CRUD operations, pending item review
- Category dropdowns: populated from API, "suggest new" flow

### Test patterns
- Use existing `testHelpers.ts` for creating test users, auth tokens, and Prisma client
- Each test file should test both happy path and auth rejection (non-admin attempting admin operations)

---

## 13. Data Migration Strategy (Phase 5)

### Problem
Existing `Aircraft` records have a free-text `aircraftType` string and an optional `aircraftTypeId` FK to `AircraftType`. The new hierarchy (Manufacturer → Family → Variant) needs to be linked.

### Approach

1. **Build mapping table (CSV):** Create a CSV that maps `AircraftType.vendor` + `AircraftType.model` → `manufacturerId` + `familyId` + `variantId`. This is a **manual curation step** — automated fuzzy matching can generate a draft, but human review is required.

2. **Migration script** (`packages/db/prisma/migrate-aircraft-hierarchy.ts`):
   - For each `Aircraft` with an `aircraftTypeId`:
     - Look up the `AircraftType` → get `vendor` and `model`
     - Look up the mapping table → set `manufacturerId`, `familyId`, `variantId`
   - For `Aircraft` without `aircraftTypeId` but with `aircraftType` string:
     - Attempt fuzzy match against mapping table
     - Log unmatched records for manual review
   - Script is **idempotent** — skips already-linked records

3. **Airline migration:**
   - For each `Aircraft` with a free-text `airline` string:
     - Attempt match against `Airline.name` (case-insensitive)
     - Set `airlineId` on matched records
     - Log unmatched records for manual review

4. **Validation step:**
   - After migration, run a report query: count of Aircraft with/without manufacturer/family/variant/airline links
   - Target: >90% linked, remaining flagged for manual curation

5. **Cleanup (separate migration, after validation):**
   - Consider deprecating `Aircraft.aircraftType` (free-text string) and `Aircraft.airline` (free-text string) once all records are linked
   - Keep `Aircraft.aircraftTypeId` — it remains useful as the canonical OpenFlights type reference

---

## 14. Implementation Order

### Phase 1: Database & Models
1. Add `OperatorType` enum to schema
2. Add `AircraftManufacturer`, `AircraftFamily`, `AircraftVariant`, `Airline` models
3. Add `PhotoCategory`, `AircraftSpecificCategory` models (lookup tables)
4. Add `PendingListItem` model
5. Extend `Aircraft` model with FKs to new models + `operatorType`
6. Extend `Photo` model with new fields (`exifData`, `photoCategoryId`, `aircraftSpecificCategoryId`, `operatorIcao`)
7. Add `locationType` and `country` to `PhotoLocation`
8. Make `PhotoLocation.rawLatitude` and `rawLongitude` optional
9. Run `npx prisma migrate dev`
10. Seed initial data (manufacturers, families, variants, airlines, categories)

### Phase 2: GraphQL API
1. Add new query resolvers for manufacturers, families, variants, airlines, categories
2. Add `airport(icaoCode)` and `airline(icaoCode)` auto-fill queries
3. Add new mutation resolvers (CRUD for new models) with admin auth guards
4. Add `submitListItem` and `reviewListItem` mutations with metadata validation
5. Update `CreatePhotoInput` / `UpdatePhotoInput` to include new fields
6. Update `PhotoLocationInput` to accept `airportIcao` and `locationType`
7. Update `PHOTO_FIELDS` fragment with new fields and relations
8. Regenerate GraphQL types (`npx graphql-codegen`)
9. Write API resolver tests for all new resolvers

### Phase 3: Frontend — Photo Upload/Edit
1. Add new fields to photo upload form (category dropdowns, operatorIcao, locationType)
2. Implement airport ICAO typeahead → `airport(icaoCode)` → auto-fill location section
3. Implement operator ICAO typeahead → `airline(icaoCode)` → auto-fill airline display
4. Implement registration typeahead → `aircraft(registration)` → auto-fill aircraft hierarchy (display only, not persisted on Photo)
5. Add non-airport location flow: map pin → reverse geocode → country + locationType
6. Add list contribution UI: if user types a value not in dropdown, offer "Submit new [listType]" option
7. Write frontend tests for auto-fill flows

### Phase 4: Admin Pages
1. Build `/admin/pending-list-items` — show all pending submissions, approve/reject per item
2. Build `/admin/manufacturers`, `/admin/families`, `/admin/variants`, `/admin/airlines` — standard CRUD + CSV import/export
3. Build `/admin/photo-categories`, `/admin/aircraft-specific-categories` — list editors with sortOrder
4. Extend `/admin/aircraft` with new columns (manufacturer, family, variant, operatorType, airline)
5. Write admin page tests

### Phase 5: Data Migration & Cleanup
1. Build manufacturer/family/variant mapping CSV from existing `AircraftType` data
2. Write and run `migrate-aircraft-hierarchy.ts` script
3. Write and run airline migration script
4. Run validation report — review unmatched records
5. Manual curation of unmatched records
6. Consider deprecating free-text `Aircraft.aircraftType` and `Aircraft.airline` fields
