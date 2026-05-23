import type { Context } from '../context.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhotosInBoundsArgs {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
  first?: number;
}

export interface PhotosNearbyArgs {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  first?: number;
}

interface RawPhotoMarker {
  id: string;
  display_latitude: number;
  display_longitude: number;
  thumbnail_url: string | null;
  caption: string | null;
  created_at?: Date;
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const locationQueryResolvers = {
  photosInBounds: async (_parent: unknown, args: PhotosInBoundsArgs, ctx: Context) => {
    const limit = Math.min(args.first ?? 100, 500);

    // When the viewport crosses the antimeridian (Pacific-centred pan),
    // Mapbox returns sw.lng > ne.lng. Express the longitude predicate with
    // a CASE so a single parameterised query covers both shapes.
    const crossesAntimeridian = args.swLng > args.neLng;

    // Branch (a): photos with a PhotoLocation row whose display coords are
    // in bounds. Honours per-photo privacy (excludes 'hidden').
    //
    // Branch (b): legacy / imported photos that link to an airport via
    // `Photo.airport_code` but have NO PhotoLocation row. We project the
    // airport's lat/lng so they still appear on the map. Bound check is
    // applied to the airport coordinates.
    //
    // UNION ALL is safe because branch (b) excludes any photo that already
    // has a PhotoLocation, so the two sets are disjoint by construction.
    const rows = crossesAntimeridian
      ? await ctx.prisma.$queryRaw<RawPhotoMarker[]>`
          SELECT id, display_latitude, display_longitude, thumbnail_url, caption, created_at
          FROM (
            SELECT
              pl.id,
              pl.display_latitude,
              pl.display_longitude,
              pv.url AS thumbnail_url,
              p.caption,
              p.created_at
            FROM photo_locations pl
            JOIN photos p ON p.id = pl.photo_id
            LEFT JOIN photo_variants pv ON pv.photo_id = p.id AND pv.variant_type = 'thumbnail'
            WHERE pl.display_latitude BETWEEN ${args.swLat} AND ${args.neLat}
              AND (pl.display_longitude BETWEEN ${args.swLng} AND 180
                OR pl.display_longitude BETWEEN -180 AND ${args.neLng})
              AND pl.privacy_mode != 'hidden'
              AND p.moderation_status = 'approved'
              AND p.is_deleted = false

            UNION ALL

            SELECT
              p.id,
              a.latitude AS display_latitude,
              a.longitude AS display_longitude,
              pv.url AS thumbnail_url,
              p.caption,
              p.created_at
            FROM photos p
            JOIN airports a
              ON UPPER(p.airport_code) = a.icao_code
              OR UPPER(p.airport_code) = a.iata_code
            LEFT JOIN photo_locations pl ON pl.photo_id = p.id
            LEFT JOIN photo_variants pv ON pv.photo_id = p.id AND pv.variant_type = 'thumbnail'
            WHERE pl.id IS NULL
              AND p.airport_code IS NOT NULL
              AND p.moderation_status = 'approved'
              AND p.is_deleted = false
              AND a.latitude BETWEEN ${args.swLat} AND ${args.neLat}
              AND (a.longitude BETWEEN ${args.swLng} AND 180
                OR a.longitude BETWEEN -180 AND ${args.neLng})
          ) AS combined
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await ctx.prisma.$queryRaw<RawPhotoMarker[]>`
          SELECT id, display_latitude, display_longitude, thumbnail_url, caption, created_at
          FROM (
            SELECT
              pl.id,
              pl.display_latitude,
              pl.display_longitude,
              pv.url AS thumbnail_url,
              p.caption,
              p.created_at
            FROM photo_locations pl
            JOIN photos p ON p.id = pl.photo_id
            LEFT JOIN photo_variants pv ON pv.photo_id = p.id AND pv.variant_type = 'thumbnail'
            WHERE pl.display_latitude BETWEEN ${args.swLat} AND ${args.neLat}
              AND pl.display_longitude BETWEEN ${args.swLng} AND ${args.neLng}
              AND pl.privacy_mode != 'hidden'
              AND p.moderation_status = 'approved'
              AND p.is_deleted = false

            UNION ALL

            SELECT
              p.id,
              a.latitude AS display_latitude,
              a.longitude AS display_longitude,
              pv.url AS thumbnail_url,
              p.caption,
              p.created_at
            FROM photos p
            JOIN airports a
              ON UPPER(p.airport_code) = a.icao_code
              OR UPPER(p.airport_code) = a.iata_code
            LEFT JOIN photo_locations pl ON pl.photo_id = p.id
            LEFT JOIN photo_variants pv ON pv.photo_id = p.id AND pv.variant_type = 'thumbnail'
            WHERE pl.id IS NULL
              AND p.airport_code IS NOT NULL
              AND p.moderation_status = 'approved'
              AND p.is_deleted = false
              AND a.latitude BETWEEN ${args.swLat} AND ${args.neLat}
              AND a.longitude BETWEEN ${args.swLng} AND ${args.neLng}
          ) AS combined
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    return rows.map((r) => ({
      id: r.id,
      latitude: r.display_latitude,
      longitude: r.display_longitude,
      thumbnailUrl: r.thumbnail_url,
      caption: r.caption,
    }));
  },

  photosNearby: async (_parent: unknown, args: PhotosNearbyArgs, ctx: Context) => {
    const limit = Math.min(args.first ?? 50, 200);
    const radius = args.radiusMeters ?? 5000;

    // Constructs geography points on-the-fly from display coordinates.
    // A dedicated geom column with a GIST index would be faster at scale
    // but this works without a raw SQL migration for the computed column.
    const rows = await ctx.prisma.$queryRaw<RawPhotoMarker[]>`
      SELECT
        pl.id,
        pl.display_latitude,
        pl.display_longitude,
        pv.url AS thumbnail_url,
        p.caption
      FROM photo_locations pl
      JOIN photos p ON p.id = pl.photo_id
      LEFT JOIN photo_variants pv ON pv.photo_id = p.id AND pv.variant_type = 'thumbnail'
      WHERE pl.privacy_mode != 'hidden'
        AND p.moderation_status = 'approved'
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(pl.display_longitude, pl.display_latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${args.longitude}, ${args.latitude}), 4326)::geography,
          ${radius}
        )
      ORDER BY ST_Distance(
        ST_SetSRID(ST_MakePoint(pl.display_longitude, pl.display_latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${args.longitude}, ${args.latitude}), 4326)::geography
      )
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      latitude: r.display_latitude,
      longitude: r.display_longitude,
      thumbnailUrl: r.thumbnail_url,
      caption: r.caption,
    }));
  },
};
