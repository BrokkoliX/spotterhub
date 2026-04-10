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
}

// ─── Query Resolvers ────────────────────────────────────────────────────────

export const locationQueryResolvers = {
  photosInBounds: async (
    _parent: unknown,
    args: PhotosInBoundsArgs,
    ctx: Context,
  ) => {
    const limit = Math.min(args.first ?? 100, 500);

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
      WHERE pl.display_latitude BETWEEN ${args.swLat} AND ${args.neLat}
        AND pl.display_longitude BETWEEN ${args.swLng} AND ${args.neLng}
        AND pl.privacy_mode != 'hidden'
        AND p.moderation_status IN ('approved', 'pending')
      ORDER BY p.created_at DESC
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

  photosNearby: async (
    _parent: unknown,
    args: PhotosNearbyArgs,
    ctx: Context,
  ) => {
    const limit = Math.min(args.first ?? 50, 200);
    const radius = args.radiusMeters ?? 5000;

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
        AND p.moderation_status IN ('approved', 'pending')
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
