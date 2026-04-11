import { GraphQLScalarType, Kind } from 'graphql';

import {
  commentFieldResolvers,
  commentMutationResolvers,
  commentQueryResolvers,
} from './resolvers/commentResolvers.js';
import {
  airportFollowFieldResolvers,
  followFieldResolvers,
  followMutationResolvers,
  followQueryResolvers,
} from './resolvers/followResolvers.js';
import {
  likeFieldResolvers,
  likeMutationResolvers,
} from './resolvers/likeResolvers.js';
import {
  photoFieldResolvers,
  photoMutationResolvers,
  photoQueryResolvers,
} from './resolvers/photoResolvers.js';
import {
  airportFieldResolvers,
  airportQueryResolvers,
} from './resolvers/airportResolvers.js';
import { adminMutationResolvers, adminQueryResolvers } from './resolvers/adminResolvers.js';
import {
  communityFieldResolvers,
  communityMemberFieldResolvers,
  communityMutationResolvers,
  communityQueryResolvers,
} from './resolvers/communityResolvers.js';
import {
  communityModerationLogFieldResolvers,
  communityModerationMutationResolvers,
  communityModerationQueryResolvers,
} from './resolvers/communityModerationResolvers.js';
import {
  forumCategoryFieldResolvers,
  forumMutationResolvers,
  forumPostFieldResolvers,
  forumQueryResolvers,
  forumThreadFieldResolvers,
} from './resolvers/forumResolvers.js';
import {
  communityEventFieldResolvers,
  eventAttendeeFieldResolvers,
  eventMutationResolvers,
  eventQueryResolvers,
} from './resolvers/eventResolvers.js';
import {
  notificationFieldResolvers,
  notificationMutationResolvers,
  notificationQueryResolvers,
} from './resolvers/notificationResolvers.js';
import {
  albumFieldResolvers,
  albumMutationResolvers,
  albumQueryResolvers,
} from './resolvers/albumResolvers.js';
import { locationQueryResolvers } from './resolvers/locationResolvers.js';
import { reportMutationResolvers } from './resolvers/reportResolvers.js';
import { searchQueryResolvers } from './resolvers/searchResolvers.js';
import { spottingLocationMutationResolvers } from './resolvers/spottingLocationResolvers.js';
import { authMutationResolvers } from './resolvers/authResolvers.js';
import { profileMutationResolvers } from './resolvers/profileResolvers.js';
import { userFieldResolvers, userQueryResolvers } from './resolvers/userResolvers.js';
import {
  siteSettingsMutationResolvers,
  siteSettingsQueryResolvers,
} from './resolvers/siteSettingsResolvers.js';

// ─── JSON Scalar ────────────────────────────────────────────────────────────

function parseLiteralAst(ast: import('graphql').ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
      try { return JSON.parse(ast.value); } catch { return ast.value; }
    case Kind.INT:
      return parseInt(ast.value, 10);
    case Kind.FLOAT:
      return parseFloat(ast.value);
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseLiteralAst);
    case Kind.OBJECT:
      return Object.fromEntries(
        ast.fields.map((field) => [field.name.value, parseLiteralAst(field.value)]),
      );
    default:
      return null;
  }
}

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: parseLiteralAst,
});

// ─── Resolver Map ───────────────────────────────────────────────────────────

export const resolvers = {
  JSON: JSONScalar,

  Query: {
    ...userQueryResolvers,
    ...photoQueryResolvers,
    ...commentQueryResolvers,
    ...searchQueryResolvers,
    ...airportQueryResolvers,
    ...albumQueryResolvers,
    ...followQueryResolvers,
    ...locationQueryResolvers,
    ...adminQueryResolvers,
    ...communityQueryResolvers,
    ...communityModerationQueryResolvers,
    ...forumQueryResolvers,
    ...eventQueryResolvers,
    ...notificationQueryResolvers,
    ...siteSettingsQueryResolvers,
  },

  Mutation: {
    ...authMutationResolvers,
    ...profileMutationResolvers,
    ...photoMutationResolvers,
    ...likeMutationResolvers,
    ...followMutationResolvers,
    ...commentMutationResolvers,
    ...albumMutationResolvers,
    ...reportMutationResolvers,
    ...spottingLocationMutationResolvers,
    ...adminMutationResolvers,
    ...communityMutationResolvers,
    ...communityModerationMutationResolvers,
    ...forumMutationResolvers,
    ...eventMutationResolvers,
    ...notificationMutationResolvers,
    ...siteSettingsMutationResolvers,
  },

  User: {
    ...userFieldResolvers,
    ...followFieldResolvers,
  },

  Photo: {
    ...photoFieldResolvers,
    ...likeFieldResolvers,
  },

  Comment: commentFieldResolvers,

  Airport: {
    ...airportFieldResolvers,
    ...airportFollowFieldResolvers,
  },

  Album: albumFieldResolvers,

  Community: communityFieldResolvers,

  CommunityMember: communityMemberFieldResolvers,

  CommunityModerationLog: communityModerationLogFieldResolvers,

  ForumCategory: forumCategoryFieldResolvers,

  ForumThread: forumThreadFieldResolvers,

  ForumPost: forumPostFieldResolvers,

  CommunityEvent: communityEventFieldResolvers,

  EventAttendee: eventAttendeeFieldResolvers,

  Notification: notificationFieldResolvers,
};
