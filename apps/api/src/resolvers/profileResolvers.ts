import { GraphQLError } from 'graphql';

import { requireAuth } from '../auth/requireAuth.js';
import type { Context } from '../context.js';

// ─── Validation Constants ───────────────────────────────────────────────────

const VALID_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;

/**
 * Maximum length for a social-media handle. Real-world platform limits are
 * tighter (Instagram 30, X 15) but a single shared cap keeps validation
 * simple and is well within all provider limits.
 */
const MAX_HANDLE_LENGTH = 30;

/**
 * Maximum length for a stored URL. Long enough for any reasonable Facebook
 * profile URL while preventing pathological inputs.
 */
const MAX_URL_LENGTH = 200;

/**
 * Allowed characters in Instagram and X handles: letters, numbers, dots,
 * and underscores. This is the intersection of both platforms' rules.
 */
const HANDLE_PATTERN = /^[A-Za-z0-9_.]+$/;

/**
 * URL prefixes we strip when normalizing a pasted handle. Users frequently
 * copy a profile URL from their browser instead of typing the bare handle,
 * so we accept both shapes and store the canonical bare form.
 */
const INSTAGRAM_URL_PREFIXES = [
  'https://www.instagram.com/',
  'https://instagram.com/',
  'http://www.instagram.com/',
  'http://instagram.com/',
];

const X_URL_PREFIXES = [
  'https://www.x.com/',
  'https://x.com/',
  'http://www.x.com/',
  'http://x.com/',
  'https://www.twitter.com/',
  'https://twitter.com/',
  'http://www.twitter.com/',
  'http://twitter.com/',
];

// ─── Normalization Helpers ──────────────────────────────────────────────────

/**
 * Normalize a social-media handle: trim whitespace, strip a leading '@',
 * strip any of the supplied URL prefixes (and any trailing slash + query
 * string), then validate the result against `HANDLE_PATTERN`. Empty input
 * returns null so the column can be cleared by submitting a blank field.
 */
function normalizeHandle(
  raw: string,
  urlPrefixes: readonly string[],
  fieldLabel: string,
): string | null {
  let value = raw.trim();
  if (value === '') return null;

  for (const prefix of urlPrefixes) {
    if (value.toLowerCase().startsWith(prefix)) {
      value = value.slice(prefix.length);
      break;
    }
  }

  // Drop any trailing path/query (e.g. "username/" or "username?hl=en").
  const slashIdx = value.indexOf('/');
  if (slashIdx >= 0) value = value.slice(0, slashIdx);
  const qIdx = value.indexOf('?');
  if (qIdx >= 0) value = value.slice(0, qIdx);

  if (value.startsWith('@')) value = value.slice(1);
  value = value.trim();
  if (value === '') return null;

  if (value.length > MAX_HANDLE_LENGTH) {
    throw new GraphQLError(`${fieldLabel} must be ${MAX_HANDLE_LENGTH} characters or fewer.`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  if (!HANDLE_PATTERN.test(value)) {
    throw new GraphQLError(
      `${fieldLabel} may only contain letters, numbers, dots, and underscores.`,
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
  return value;
}

/**
 * Normalize a URL field: trim, treat empty as null, require an http(s)
 * scheme that parses cleanly, and enforce a length cap. We intentionally
 * do NOT restrict to a specific host (e.g. facebook.com) because users
 * legitimately use facebook.com, m.facebook.com, fb.com, and locale
 * subdomains interchangeably; the host check would block valid input
 * without meaningfully improving safety.
 */
function normalizeUrl(raw: string, fieldLabel: string): string | null {
  const value = raw.trim();
  if (value === '') return null;

  if (value.length > MAX_URL_LENGTH) {
    throw new GraphQLError(`${fieldLabel} must be ${MAX_URL_LENGTH} characters or fewer.`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new GraphQLError(
      `${fieldLabel} must be a valid URL (e.g. https://www.facebook.com/yourname).`,
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new GraphQLError(`${fieldLabel} must use http or https.`, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  return parsed.toString();
}

/**
 * Apply per-field normalization to any social-link inputs present in the
 * mutation payload. Mutates a shallow copy so the caller's object is not
 * touched. A field that is `undefined` is left absent (partial update);
 * `null` and empty string both clear the column.
 */
function normalizeSocialLinks(input: Record<string, unknown>): Record<string, unknown> {
  const out = { ...input };

  if ('instagramHandle' in out) {
    const v = out.instagramHandle;
    out.instagramHandle =
      v == null ? null : normalizeHandle(String(v), INSTAGRAM_URL_PREFIXES, 'Instagram handle');
  }
  if ('xHandle' in out) {
    const v = out.xHandle;
    out.xHandle = v == null ? null : normalizeHandle(String(v), X_URL_PREFIXES, 'X handle');
  }
  if ('facebookUrl' in out) {
    const v = out.facebookUrl;
    out.facebookUrl = v == null ? null : normalizeUrl(String(v), 'Facebook URL');
  }

  return out;
}

// ─── Mutation Resolvers ─────────────────────────────────────────────────────

export const profileMutationResolvers = {
  updateProfile: async (
    _parent: unknown,
    args: { input: Record<string, unknown> },
    ctx: Context,
  ) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });

    if (!user) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (
      args.input.experienceLevel &&
      !VALID_EXPERIENCE_LEVELS.includes(
        args.input.experienceLevel as (typeof VALID_EXPERIENCE_LEVELS)[number],
      )
    ) {
      throw new GraphQLError(
        `Invalid experience level. Must be one of: ${VALID_EXPERIENCE_LEVELS.join(', ')}`,
        { extensions: { code: 'BAD_USER_INPUT' } },
      );
    }

    const normalized = normalizeSocialLinks(args.input);

    return ctx.prisma.profile.upsert({
      where: { userId: user.id },
      update: normalized,
      create: {
        userId: user.id,
        ...normalized,
      },
    });
  },

  updateAvatar: async (_parent: unknown, args: { avatarUrl: string }, ctx: Context) => {
    const authUser = requireAuth(ctx);
    const user = await ctx.prisma.user.findUnique({
      where: { cognitoSub: authUser.sub },
      select: { id: true },
    });

    if (!user) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return ctx.prisma.profile.upsert({
      where: { userId: user.id },
      update: { avatarUrl: args.avatarUrl },
      create: { userId: user.id, avatarUrl: args.avatarUrl },
    });
  },
};
