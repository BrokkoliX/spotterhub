import gql from 'graphql-tag';
import * as Urql from 'urql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: any; output: any; }
};

export type AddCommentInput = {
  /** The comment text (1-2000 characters). */
  body: Scalars['String']['input'];
  /** Optional parent comment ID for threaded replies. */
  parentCommentId?: InputMaybe<Scalars['ID']['input']>;
  /** The photo to comment on. */
  photoId: Scalars['ID']['input'];
};

/** Dashboard statistics for the admin panel. */
export type AdminStats = {
  __typename?: 'AdminStats';
  openReports: Scalars['Int']['output'];
  pendingPhotos: Scalars['Int']['output'];
  totalAirports: Scalars['Int']['output'];
  totalPhotos: Scalars['Int']['output'];
  totalSpottingLocations: Scalars['Int']['output'];
  totalUsers: Scalars['Int']['output'];
};

/** A known aircraft with MSN and manufacturing info. */
export type Aircraft = {
  __typename?: 'Aircraft';
  /** Aircraft type name (e.g., Boeing 737 MAX 8). */
  aircraftType: Scalars['String']['output'];
  /** Canonical aircraft type from OpenFlights. */
  aircraftTypeRef?: Maybe<AircraftType>;
  /** Airline or operator. */
  airline?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Date the aircraft was manufactured. */
  manufacturingDate?: Maybe<Scalars['String']['output']>;
  /** Manufacturer serial number. */
  msn?: Maybe<Scalars['String']['output']>;
  /** Registration (tail number). */
  registration: Scalars['String']['output'];
};

export type AircraftConnection = {
  __typename?: 'AircraftConnection';
  edges: Array<AircraftEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AircraftEdge = {
  __typename?: 'AircraftEdge';
  cursor: Scalars['String']['output'];
  node: Aircraft;
};

/** Canonical aircraft type from OpenFlights (type-level, not individual aircraft). */
export type AircraftType = {
  __typename?: 'AircraftType';
  /** Category: Jet, Propeller, Helicopter, etc. */
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  /** Number of engines. */
  engineCount?: Maybe<Scalars['Int']['output']>;
  /** Engine type: Jet, Turboprop, Piston, etc. */
  engineType?: Maybe<Scalars['String']['output']>;
  /** IATA aircraft type code (e.g., '738'). */
  iataCode?: Maybe<Scalars['String']['output']>;
  /** ICAO aircraft type code (e.g., 'B738'). */
  icaoCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Aircraft model (e.g., '737-86N'). */
  model: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  /** Manufacturer/vendor name (e.g., 'Boeing'). */
  vendor: Scalars['String']['output'];
};

export type AircraftTypeConnection = {
  __typename?: 'AircraftTypeConnection';
  edges: Array<AircraftTypeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AircraftTypeEdge = {
  __typename?: 'AircraftTypeEdge';
  cursor: Scalars['String']['output'];
  node: AircraftType;
};

/** An airport with geographic coordinates and associated photos. */
export type Airport = {
  __typename?: 'Airport';
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  /** Number of users following this airport. */
  followerCount: Scalars['Int']['output'];
  iataCode?: Maybe<Scalars['String']['output']>;
  icaoCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Whether the authenticated user follows this airport. */
  isFollowedByMe: Scalars['Boolean']['output'];
  latitude: Scalars['Float']['output'];
  longitude: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  /** Number of photos taken at this airport. */
  photoCount: Scalars['Int']['output'];
  /** Spotting locations near this airport. */
  spottingLocations: Array<SpottingLocation>;
};

export type AirportConnection = {
  __typename?: 'AirportConnection';
  edges: Array<AirportEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AirportEdge = {
  __typename?: 'AirportEdge';
  cursor: Scalars['String']['output'];
  node: Airport;
};

/** Minimal airport info for typeahead search results. */
export type AirportSearchResult = {
  __typename?: 'AirportSearchResult';
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  iataCode?: Maybe<Scalars['String']['output']>;
  icaoCode: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

/** A curated collection of photos created by a user. */
export type Album = {
  __typename?: 'Album';
  community?: Maybe<Community>;
  /** Community this album belongs to, if any. */
  communityId?: Maybe<Scalars['ID']['output']>;
  /** Optional cover photo for the album. */
  coverPhoto?: Maybe<Photo>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPublic: Scalars['Boolean']['output'];
  /** Current user's membership in the community this album belongs to (null if not a community album). */
  myMembership?: Maybe<CommunityMember>;
  /** Total number of photos in this album. */
  photoCount: Scalars['Int']['output'];
  /** Photos in this album (junction-table based for community albums). */
  photos: PhotoConnection;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  /** The user who created this album. */
  user: User;
};


/** A curated collection of photos created by a user. */
export type AlbumPhotosArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type AlbumConnection = {
  __typename?: 'AlbumConnection';
  edges: Array<AlbumEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type AlbumEdge = {
  __typename?: 'AlbumEdge';
  cursor: Scalars['String']['output'];
  node: Album;
};

/**
 * Returned after successful authentication. Contains the JWT token
 * and the authenticated user record.
 */
export type AuthPayload = {
  __typename?: 'AuthPayload';
  /** JWT access token for subsequent authenticated requests. */
  token: Scalars['String']['output'];
  /** The authenticated user. */
  user: User;
};

/** A comment on a photo, with optional threaded replies. */
export type Comment = {
  __typename?: 'Comment';
  /** The comment text. */
  body: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Nested replies to this comment. */
  replies: Array<Comment>;
  updatedAt: Scalars['String']['output'];
  /** The user who wrote this comment. */
  user: User;
};

/** Relay-style connection for paginated comment lists. */
export type CommentConnection = {
  __typename?: 'CommentConnection';
  edges: Array<CommentEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommentEdge = {
  __typename?: 'CommentEdge';
  cursor: Scalars['String']['output'];
  node: Comment;
};

/** A spotting community that users can join and participate in. */
export type Community = {
  __typename?: 'Community';
  /** Community albums. Only present for community-scoped albums. */
  albums: AlbumConnection;
  avatarUrl?: Maybe<Scalars['String']['output']>;
  bannerUrl?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  inviteCode?: Maybe<Scalars['String']['output']>;
  location?: Maybe<Scalars['String']['output']>;
  /** Total number of members. */
  memberCount: Scalars['Int']['output'];
  /** Paginated list of community members. */
  members: CommunityMemberConnection;
  /** Current user's membership, if any. */
  myMembership?: Maybe<CommunityMember>;
  name: Scalars['String']['output'];
  /** The community owner. */
  owner: User;
  /** Recent photos from community members. */
  photos: PhotoConnection;
  slug: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  visibility: Scalars['String']['output'];
};


/** A spotting community that users can join and participate in. */
export type CommunityAlbumsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


/** A spotting community that users can join and participate in. */
export type CommunityMembersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


/** A spotting community that users can join and participate in. */
export type CommunityPhotosArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type CommunityConnection = {
  __typename?: 'CommunityConnection';
  edges: Array<CommunityEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommunityEdge = {
  __typename?: 'CommunityEdge';
  cursor: Scalars['String']['output'];
  node: Community;
};

/** A community-scoped event with optional RSVP and capacity limit. */
export type CommunityEvent = {
  __typename?: 'CommunityEvent';
  /** Number of attendees with status 'going'. */
  attendeeCount: Scalars['Int']['output'];
  communityId: Scalars['ID']['output'];
  coverUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  /** ISO datetime string, optional end time. */
  endsAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Whether the event is at capacity. */
  isFull: Scalars['Boolean']['output'];
  location?: Maybe<Scalars['String']['output']>;
  /** Maximum number of attendees. Null means unlimited. */
  maxAttendees?: Maybe<Scalars['Int']['output']>;
  /** The current user's RSVP, if any. */
  myRsvp?: Maybe<EventAttendee>;
  /** The user who created the event. */
  organizer: User;
  /** ISO datetime string. */
  startsAt: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type CommunityEventConnection = {
  __typename?: 'CommunityEventConnection';
  edges: Array<CommunityEventEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommunityEventEdge = {
  __typename?: 'CommunityEventEdge';
  cursor: Scalars['String']['output'];
  node: CommunityEvent;
};

/** A member of a community with their role and status. */
export type CommunityMember = {
  __typename?: 'CommunityMember';
  community: Community;
  id: Scalars['ID']['output'];
  joinedAt: Scalars['String']['output'];
  role: Scalars['String']['output'];
  status: Scalars['String']['output'];
  user: User;
};

export type CommunityMemberConnection = {
  __typename?: 'CommunityMemberConnection';
  edges: Array<CommunityMemberEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommunityMemberEdge = {
  __typename?: 'CommunityMemberEdge';
  cursor: Scalars['String']['output'];
  node: CommunityMember;
};

/** A record of a moderation action taken in a community. */
export type CommunityModerationLog = {
  __typename?: 'CommunityModerationLog';
  /** The action taken: ban | unban | kick | pin_thread | unpin_thread | lock_thread | unlock_thread | delete_post */
  action: Scalars['String']['output'];
  /** The community where the action was taken. */
  community: Community;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** JSON metadata (e.g. threadId for forum actions). */
  metadata?: Maybe<Scalars['JSON']['output']>;
  /** The moderator who performed the action. */
  moderator: User;
  /** Optional reason for the action. */
  reason?: Maybe<Scalars['String']['output']>;
  /** The user who was targeted by the action. */
  targetUser: User;
};

export type CommunityModerationLogConnection = {
  __typename?: 'CommunityModerationLogConnection';
  edges: Array<CommunityModerationLogEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type CommunityModerationLogEdge = {
  __typename?: 'CommunityModerationLogEdge';
  cursor: Scalars['String']['output'];
  node: CommunityModerationLog;
};

export type CreateAircraftInput = {
  aircraftType: Scalars['String']['input'];
  aircraftTypeId?: InputMaybe<Scalars['ID']['input']>;
  airline?: InputMaybe<Scalars['String']['input']>;
  manufacturingDate?: InputMaybe<Scalars['String']['input']>;
  msn?: InputMaybe<Scalars['String']['input']>;
  registration: Scalars['String']['input'];
};

export type CreateAircraftTypeInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  engineCount?: InputMaybe<Scalars['Int']['input']>;
  engineType?: InputMaybe<Scalars['String']['input']>;
  iataCode?: InputMaybe<Scalars['String']['input']>;
  icaoCode: Scalars['String']['input'];
  model: Scalars['String']['input'];
  vendor: Scalars['String']['input'];
};

export type CreateAirportInput = {
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  iataCode?: InputMaybe<Scalars['String']['input']>;
  icaoCode: Scalars['String']['input'];
  latitude: Scalars['Float']['input'];
  longitude: Scalars['Float']['input'];
  name: Scalars['String']['input'];
};

export type CreateAlbumInput = {
  /** Optional description. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Whether the album is publicly visible. Defaults to true. */
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** Album title (required, max 100 characters). */
  title: Scalars['String']['input'];
};

export type CreateCommunityEventInput = {
  coverUrl?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  /** ISO datetime string, optional. */
  endsAt?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  maxAttendees?: InputMaybe<Scalars['Int']['input']>;
  /** ISO datetime string. */
  startsAt: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateCommunityInput = {
  /** Community category (e.g. 'military', 'airliners', 'general-aviation'). */
  category?: InputMaybe<Scalars['String']['input']>;
  /** Description of the community. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Geographic location or region. */
  location?: InputMaybe<Scalars['String']['input']>;
  /** Community name (3–100 characters). */
  name: Scalars['String']['input'];
  /** URL-friendly slug (3–50 characters, lowercase alphanumeric + hyphens). */
  slug: Scalars['String']['input'];
  /** Visibility: 'public' or 'invite_only'. */
  visibility?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePhotoInput = {
  /** Link to a structured Aircraft record. */
  aircraftId?: InputMaybe<Scalars['ID']['input']>;
  /** Aircraft type. */
  aircraftType?: InputMaybe<Scalars['String']['input']>;
  /** Link to a canonical AircraftType (OpenFlights). */
  aircraftTypeId?: InputMaybe<Scalars['ID']['input']>;
  /** Airline name. */
  airline?: InputMaybe<Scalars['String']['input']>;
  /** Airport ICAO or IATA code. */
  airportCode?: InputMaybe<Scalars['String']['input']>;
  /** Photo caption or description. */
  caption?: InputMaybe<Scalars['String']['input']>;
  /** File size in bytes. */
  fileSizeBytes: Scalars['Int']['input'];
  /** Camera body used (from user's gear list). */
  gearBody?: InputMaybe<Scalars['String']['input']>;
  /** Lens used (from user's gear list). */
  gearLens?: InputMaybe<Scalars['String']['input']>;
  /** Latitude of where the photo was taken. */
  latitude?: InputMaybe<Scalars['Float']['input']>;
  /** Location privacy mode: exact (default), approximate, or hidden. */
  locationPrivacy?: InputMaybe<Scalars['String']['input']>;
  /** Longitude of where the photo was taken. */
  longitude?: InputMaybe<Scalars['Float']['input']>;
  /** MIME type of the uploaded file. */
  mimeType: Scalars['String']['input'];
  /** S3 object key returned from getUploadUrl. */
  s3Key: Scalars['String']['input'];
  /** Tags to apply to the photo. */
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Date/time the photo was taken (ISO 8601). */
  takenAt?: InputMaybe<Scalars['String']['input']>;
};

export type CreateReportInput = {
  /** Additional details (required when reason is 'other'). */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Reason: inappropriate, spam, harassment, copyright, or other. */
  reason: Scalars['String']['input'];
  /** ID of the content to report. */
  targetId: Scalars['ID']['input'];
  /** Type of content: photo, comment, profile, or album. */
  targetType: Scalars['String']['input'];
};

export type CreateSpottingLocationInput = {
  /** Access notes (parking, public transit, etc.). */
  accessNotes?: InputMaybe<Scalars['String']['input']>;
  /** Airport ID this location is near. */
  airportId: Scalars['ID']['input'];
  /** Description of the location. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Latitude of the spotting location. */
  latitude: Scalars['Float']['input'];
  /** Longitude of the spotting location. */
  longitude: Scalars['Float']['input'];
  /** Name of the spotting location. */
  name: Scalars['String']['input'];
};

/** An RSVP record linking a user to an event. */
export type EventAttendee = {
  __typename?: 'EventAttendee';
  eventId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  joinedAt: Scalars['String']['output'];
  /** going | maybe | not_going */
  status: Scalars['String']['output'];
  user: User;
};

/** Represents a single follow relationship. */
export type FollowEntry = {
  __typename?: 'FollowEntry';
  /** The followed airport (if targetType is 'airport'). */
  airport?: Maybe<Airport>;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  targetType: Scalars['String']['output'];
  /** The followed value (if targetType is 'aircraft_type' or 'manufacturer'). */
  targetValue?: Maybe<Scalars['String']['output']>;
  /** The followed user (if targetType is 'user'). */
  user?: Maybe<User>;
};

/** Result of following/unfollowing a topic (aircraft_type or manufacturer). */
export type FollowedTopic = {
  __typename?: 'FollowedTopic';
  targetType: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** A discussion category within a community forum or global forum. */
export type ForumCategory = {
  __typename?: 'ForumCategory';
  communityId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Most recently active thread. */
  latestThread?: Maybe<ForumThread>;
  name: Scalars['String']['output'];
  position: Scalars['Int']['output'];
  slug: Scalars['String']['output'];
  /** Number of threads in this category. */
  threadCount: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
};

/** A post (reply) within a forum thread. */
export type ForumPost = {
  __typename?: 'ForumPost';
  author: User;
  body: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDeleted: Scalars['Boolean']['output'];
  parentPostId?: Maybe<Scalars['ID']['output']>;
  /** Direct replies to this post (max 50). */
  replies: Array<ForumPost>;
  threadId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ForumPostConnection = {
  __typename?: 'ForumPostConnection';
  edges: Array<ForumPostEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ForumPostEdge = {
  __typename?: 'ForumPostEdge';
  cursor: Scalars['String']['output'];
  node: ForumPost;
};

/** A discussion thread within a forum category. */
export type ForumThread = {
  __typename?: 'ForumThread';
  author: User;
  category: ForumCategory;
  categoryId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  /** The opening post of the thread. */
  firstPost?: Maybe<ForumPost>;
  id: Scalars['ID']['output'];
  isLocked: Scalars['Boolean']['output'];
  isPinned: Scalars['Boolean']['output'];
  lastPostAt: Scalars['String']['output'];
  postCount: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ForumThreadConnection = {
  __typename?: 'ForumThreadConnection';
  edges: Array<ForumThreadEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ForumThreadEdge = {
  __typename?: 'ForumThreadEdge';
  cursor: Scalars['String']['output'];
  node: ForumThread;
};

export type GetUploadUrlInput = {
  /** File size in bytes (for tier limit validation). */
  fileSizeBytes: Scalars['Int']['input'];
  /** MIME type of the file to upload (image/jpeg, image/png, etc.). */
  mimeType: Scalars['String']['input'];
};

export type HealthCheck = {
  __typename?: 'HealthCheck';
  dbConnected: Scalars['Boolean']['output'];
  status: Scalars['String']['output'];
  timestamp: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Add a comment to a photo. Supports threaded replies via parentCommentId. */
  addComment: Comment;
  /**
   * Add photos to an album. Only the album owner can add photos, and only
   * their own photos can be added.
   */
  addPhotosToAlbum: Album;
  /**
   * Add photos to a community album. Any active community member can add
   * their own previously-uploaded photos.
   */
  addPhotosToCommunityAlbum: Album;
  /** Resolve or dismiss a report. Requires admin or moderator role. */
  adminResolveReport: Report;
  /**
   * Update a photo's moderation status (approved, rejected, pending, review).
   * Requires admin or moderator role.
   */
  adminUpdatePhotoModeration: Photo;
  /**
   * Update a user's role (user, moderator, admin).
   * Requires admin role.
   */
  adminUpdateUserRole: User;
  /**
   * Update a user's account status (active, suspended, banned).
   * Requires admin role.
   */
  adminUpdateUserStatus: User;
  /**
   * Ban a member from the community. Sets their status to banned.
   * They cannot rejoin until unbanned. Requires owner or admin role.
   * Cannot ban members with equal or higher role.
   */
  banCommunityMember: CommunityMember;
  /** Cancel your RSVP (remove the attendance record). */
  cancelRsvp: Scalars['Boolean']['output'];
  /** Create an aircraft record. Requires admin or superuser role. */
  createAircraft: Aircraft;
  /** Create an aircraft type. Requires admin or superuser role. */
  createAircraftType: AircraftType;
  /** Create an airport. Requires admin or superuser role. */
  createAirport: Airport;
  /** Create a new album. Requires authentication. */
  createAlbum: Album;
  /** Create a new community. The creator automatically becomes the owner. */
  createCommunity: Community;
  /** Create a community-scoped album. Requires community owner or admin role. */
  createCommunityAlbum: Album;
  /** Create an event in a community. Requires owner or admin role. */
  createCommunityEvent: CommunityEvent;
  /** Create a forum category in a community. Requires owner or admin role. Pass communityId: null for global categories (admin only). */
  createForumCategory: ForumCategory;
  /** Post a reply in a thread. Any active community member. */
  createForumPost: ForumPost;
  /** Create a new thread in a forum category. Any active community member. */
  createForumThread: ForumThread;
  /** Create a global forum category (not tied to any community). Requires admin role. */
  createGlobalForumCategory: ForumCategory;
  /**
   * Create a photo record after the file has been uploaded to S3.
   * Triggers server-side image processing (thumbnail + display variant generation).
   * In dev, moderation is auto-approved; in production, it starts as pending.
   */
  createPhoto: Photo;
  /**
   * Report content (photo, comment, profile, or album) for moderation review.
   * Duplicate reports on the same target are prevented.
   */
  createReport: Report;
  /** Create a spotting location near an airport. Requires authentication. */
  createSpottingLocation: SpottingLocation;
  /**
   * Delete an aircraft type. Fails if any aircraft references this type.
   * Requires admin or superuser role.
   */
  deleteAircraftType: Scalars['Boolean']['output'];
  /**
   * Delete an airport. Fails if any photos reference this airport.
   * Requires admin or superuser role.
   */
  deleteAirport: Scalars['Boolean']['output'];
  /**
   * Delete an album. Photos in the album are NOT deleted — they are unlinked.
   * Only the album owner can delete.
   */
  deleteAlbum: Scalars['Boolean']['output'];
  /**
   * Delete a comment. Only the comment author can delete.
   * Deleting a parent comment cascades to all replies.
   */
  deleteComment: Scalars['Boolean']['output'];
  /** Delete a community. Requires owner role. */
  deleteCommunity: Scalars['Boolean']['output'];
  /** Delete an event. Requires owner/admin or the event organizer. */
  deleteCommunityEvent: Scalars['Boolean']['output'];
  /** Delete a forum category and all its threads. Requires owner or admin role. */
  deleteForumCategory: Scalars['Boolean']['output'];
  /** Soft-delete a post. Author or moderator+. */
  deleteForumPost: Scalars['Boolean']['output'];
  /** Delete a forum thread. Requires thread authorship or moderator+ role. */
  deleteForumThread: Scalars['Boolean']['output'];
  /** Delete a notification. Must be the notification owner. */
  deleteNotification: Scalars['Boolean']['output'];
  /** Delete a photo and all its variants. Only the photo owner can delete. */
  deletePhoto: Scalars['Boolean']['output'];
  /** Delete a spotting location. Only the creator can delete. */
  deleteSpottingLocation: Scalars['Boolean']['output'];
  /** Follow an airport. Idempotent. Returns the airport. */
  followAirport: Airport;
  /**
   * Follow a topic (aircraft_type or manufacturer). Idempotent.
   * Returns the followed topic.
   */
  followTopic: FollowedTopic;
  /**
   * Follow a user. Idempotent — following an already-followed user is a no-op.
   * Returns the target user.
   */
  followUser: User;
  /**
   * Generate or regenerate the invite code for an invite-only community.
   * Requires owner or admin role.
   */
  generateInviteCode: Community;
  /**
   * Request a presigned S3 URL for uploading a photo.
   * The client uploads directly to S3, then calls createPhoto with the returned key.
   */
  getUploadUrl: UploadUrlPayload;
  /** Join a public community, or join an invite-only community with a valid invite code. */
  joinCommunity: CommunityMember;
  /** Leave a community. Owners cannot leave (must transfer ownership or delete). */
  leaveCommunity: Scalars['Boolean']['output'];
  /**
   * Like a photo. Idempotent — liking an already-liked photo is a no-op.
   * Returns the updated photo.
   */
  likePhoto: Photo;
  /** Lock or unlock a thread. Requires moderator+ role. */
  lockForumThread: ForumThread;
  /** Mark all of the current user's notifications as read. */
  markAllNotificationsRead: Scalars['Boolean']['output'];
  /** Mark a single notification as read. Must be the notification owner. */
  markNotificationRead: Notification;
  /** Pin or unpin a thread. Requires moderator+ role. */
  pinForumThread: ForumThread;
  /**
   * Remove a member from a community. Requires owner, admin, or moderator role.
   * Cannot remove members with equal or higher roles.
   */
  removeCommunityMember: Scalars['Boolean']['output'];
  /** Remove photos from an album. Only the album owner can remove photos. */
  removePhotosFromAlbum: Album;
  /**
   * Remove photos from a community album. The member who added the photo
   * or a community admin can remove it.
   */
  removePhotosFromCommunityAlbum: Album;
  /** Request a password reminder email. Always returns true to prevent email enumeration. */
  requestPasswordReminder: Scalars['Boolean']['output'];
  /** Request a password reset email. Always returns true to prevent email enumeration. */
  requestPasswordReset: Scalars['Boolean']['output'];
  /** Reset password using a token from the email link. Token is single-use and expires in 1 hour. */
  resetPassword: AuthPayload;
  /** RSVP to an event. status: going | maybe | not_going. */
  rsvpEvent: EventAttendee;
  /**
   * Sign in with email and password (dev mode — validates credentials + issues JWT).
   * In production, authentication is handled by AWS Cognito.
   */
  signIn: AuthPayload;
  /**
   * Register a new user account (dev mode — creates user + issues JWT).
   * In production, registration is handled by AWS Cognito.
   */
  signUp: AuthPayload;
  /**
   * Unban a previously banned member. Resets status to active.
   * Requires owner or admin role.
   */
  unbanCommunityMember: CommunityMember;
  /** Unfollow an airport. Idempotent. Returns the airport. */
  unfollowAirport: Airport;
  /** Unfollow a topic. Idempotent. Returns the unfollowed topic. */
  unfollowTopic: FollowedTopic;
  /**
   * Unfollow a user. Idempotent — unfollowing a user you don't follow is a no-op.
   * Returns the target user.
   */
  unfollowUser: User;
  /**
   * Unlike a photo. Idempotent — unliking a photo you haven't liked is a no-op.
   * Returns the updated photo.
   */
  unlikePhoto: Photo;
  /** Update an aircraft record. Requires admin or superuser role. */
  updateAircraft: Aircraft;
  /** Update an aircraft type. Requires admin or superuser role. */
  updateAircraftType: AircraftType;
  /** Update an airport. Requires admin or superuser role. */
  updateAirport: Airport;
  /**
   * Update an album's title, description, visibility, or cover photo.
   * Only the album owner can update.
   */
  updateAlbum: Album;
  /**
   * Update the authenticated user's avatar URL.
   * In a future session, this will accept a file upload via presigned S3 URL.
   */
  updateAvatar: Profile;
  /** Update a comment's body. Only the comment author can update. */
  updateComment: Comment;
  /** Update a community's details. Requires owner or community admin role. */
  updateCommunity: Community;
  /** Update an event. Requires owner/admin or the event organizer. */
  updateCommunityEvent: CommunityEvent;
  /**
   * Update a member's role within a community.
   * Requires owner or admin role. Cannot promote above own role.
   */
  updateCommunityMemberRole: CommunityMember;
  /** Update a forum category. Requires owner or admin role. */
  updateForumCategory: ForumCategory;
  /** Edit a post body. Author only, within 24 hours of creation. */
  updateForumPost: ForumPost;
  /** Update metadata on an existing photo. Only the photo owner can update. */
  updatePhoto: Photo;
  /**
   * Update the authenticated user's profile.
   * Creates a profile if one does not exist yet.
   */
  updateProfile: Profile;
  /** Update site-wide settings (banner, tagline). Requires admin role. */
  updateSiteSettings: SiteSettings;
  /**
   * Upsert an aircraft type by ICAO code. If exists, updates; otherwise creates.
   * Requires admin or superuser role.
   */
  upsertAircraftType: AircraftType;
  /**
   * Upsert an airport by ICAO code. If exists, updates; otherwise creates.
   * Requires admin or superuser role.
   */
  upsertAirport: Airport;
};


export type MutationAddCommentArgs = {
  input: AddCommentInput;
};


export type MutationAddPhotosToAlbumArgs = {
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']>;
};


export type MutationAddPhotosToCommunityAlbumArgs = {
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']>;
};


export type MutationAdminResolveReportArgs = {
  action: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationAdminUpdatePhotoModerationArgs = {
  photoId: Scalars['ID']['input'];
  status: Scalars['String']['input'];
};


export type MutationAdminUpdateUserRoleArgs = {
  role: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationAdminUpdateUserStatusArgs = {
  status: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationBanCommunityMemberArgs = {
  communityId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};


export type MutationCancelRsvpArgs = {
  eventId: Scalars['ID']['input'];
};


export type MutationCreateAircraftArgs = {
  input: CreateAircraftInput;
};


export type MutationCreateAircraftTypeArgs = {
  input: CreateAircraftTypeInput;
};


export type MutationCreateAirportArgs = {
  input: CreateAirportInput;
};


export type MutationCreateAlbumArgs = {
  input: CreateAlbumInput;
};


export type MutationCreateCommunityArgs = {
  input: CreateCommunityInput;
};


export type MutationCreateCommunityAlbumArgs = {
  communityId: Scalars['ID']['input'];
  input: CreateAlbumInput;
};


export type MutationCreateCommunityEventArgs = {
  communityId: Scalars['ID']['input'];
  input: CreateCommunityEventInput;
};


export type MutationCreateForumCategoryArgs = {
  communityId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateForumPostArgs = {
  body: Scalars['String']['input'];
  parentPostId?: InputMaybe<Scalars['ID']['input']>;
  threadId: Scalars['ID']['input'];
};


export type MutationCreateForumThreadArgs = {
  body: Scalars['String']['input'];
  categoryId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
};


export type MutationCreateGlobalForumCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  slug?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreatePhotoArgs = {
  input: CreatePhotoInput;
};


export type MutationCreateReportArgs = {
  input: CreateReportInput;
};


export type MutationCreateSpottingLocationArgs = {
  input: CreateSpottingLocationInput;
};


export type MutationDeleteAircraftTypeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAirportArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteAlbumArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCommentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCommunityArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCommunityEventArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteForumCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteForumPostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteForumThreadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePhotoArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSpottingLocationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationFollowAirportArgs = {
  airportId: Scalars['ID']['input'];
};


export type MutationFollowTopicArgs = {
  targetType: Scalars['String']['input'];
  value: Scalars['String']['input'];
};


export type MutationFollowUserArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationGenerateInviteCodeArgs = {
  communityId: Scalars['ID']['input'];
};


export type MutationGetUploadUrlArgs = {
  input: GetUploadUrlInput;
};


export type MutationJoinCommunityArgs = {
  communityId: Scalars['ID']['input'];
  inviteCode?: InputMaybe<Scalars['String']['input']>;
};


export type MutationLeaveCommunityArgs = {
  communityId: Scalars['ID']['input'];
};


export type MutationLikePhotoArgs = {
  photoId: Scalars['ID']['input'];
};


export type MutationLockForumThreadArgs = {
  id: Scalars['ID']['input'];
  locked: Scalars['Boolean']['input'];
};


export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationPinForumThreadArgs = {
  id: Scalars['ID']['input'];
  pinned: Scalars['Boolean']['input'];
};


export type MutationRemoveCommunityMemberArgs = {
  communityId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationRemovePhotosFromAlbumArgs = {
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']>;
};


export type MutationRemovePhotosFromCommunityAlbumArgs = {
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']>;
};


export type MutationRequestPasswordReminderArgs = {
  email: Scalars['String']['input'];
};


export type MutationRequestPasswordResetArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationRsvpEventArgs = {
  eventId: Scalars['ID']['input'];
  status: Scalars['String']['input'];
};


export type MutationSignInArgs = {
  input: SignInInput;
};


export type MutationSignUpArgs = {
  input: SignUpInput;
};


export type MutationUnbanCommunityMemberArgs = {
  communityId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationUnfollowAirportArgs = {
  airportId: Scalars['ID']['input'];
};


export type MutationUnfollowTopicArgs = {
  targetType: Scalars['String']['input'];
  value: Scalars['String']['input'];
};


export type MutationUnfollowUserArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationUnlikePhotoArgs = {
  photoId: Scalars['ID']['input'];
};


export type MutationUpdateAircraftArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAircraftInput;
};


export type MutationUpdateAircraftTypeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAircraftTypeInput;
};


export type MutationUpdateAirportArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAirportInput;
};


export type MutationUpdateAlbumArgs = {
  id: Scalars['ID']['input'];
  input: UpdateAlbumInput;
};


export type MutationUpdateAvatarArgs = {
  avatarUrl: Scalars['String']['input'];
};


export type MutationUpdateCommentArgs = {
  body: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationUpdateCommunityArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCommunityInput;
};


export type MutationUpdateCommunityEventArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCommunityEventInput;
};


export type MutationUpdateCommunityMemberRoleArgs = {
  communityId: Scalars['ID']['input'];
  role: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationUpdateForumCategoryArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationUpdateForumPostArgs = {
  body: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationUpdatePhotoArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePhotoInput;
};


export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};


export type MutationUpdateSiteSettingsArgs = {
  input: UpdateSiteSettingsInput;
};


export type MutationUpsertAircraftTypeArgs = {
  input: CreateAircraftTypeInput;
};


export type MutationUpsertAirportArgs = {
  input: CreateAirportInput;
};

/** An in-app notification for a user. */
export type Notification = {
  __typename?: 'Notification';
  body?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  /** JSON payload with context-specific data (e.g. photoId, communityId). */
  data?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  isRead: Scalars['Boolean']['output'];
  title: Scalars['String']['output'];
  /** Notification type: like | comment | follow | mention | moderation | system | community_join | community_event */
  type: Scalars['String']['output'];
};

export type NotificationConnection = {
  __typename?: 'NotificationConnection';
  edges: Array<NotificationEdge>;
  pageInfo: PageInfo;
};

export type NotificationEdge = {
  __typename?: 'NotificationEdge';
  cursor: Scalars['String']['output'];
  node: Notification;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
};

/** An uploaded aviation photo with metadata and processing variants. */
export type Photo = {
  __typename?: 'Photo';
  /** Linked aircraft record, if any. */
  aircraft?: Maybe<Aircraft>;
  /** Aircraft type (e.g., 'Boeing 747-8F', 'Airbus A380'). */
  aircraftType?: Maybe<Scalars['String']['output']>;
  /** Canonical aircraft type from the OpenFlights database. */
  aircraftTypeRef?: Maybe<AircraftType>;
  /** Airline name. */
  airline?: Maybe<Scalars['String']['output']>;
  /** Airport ICAO or IATA code where the photo was taken. */
  airportCode?: Maybe<Scalars['String']['output']>;
  /** The album this photo belongs to, if any. */
  albumId?: Maybe<Scalars['ID']['output']>;
  /** Photo caption or description. */
  caption?: Maybe<Scalars['String']['output']>;
  /** Number of comments on this photo. */
  commentCount: Scalars['Int']['output'];
  createdAt: Scalars['String']['output'];
  /** Original file size in bytes. */
  fileSizeBytes?: Maybe<Scalars['Int']['output']>;
  /** Camera body used. */
  gearBody?: Maybe<Scalars['String']['output']>;
  /** Lens used. */
  gearLens?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Whether the currently authenticated user has liked this photo. */
  isLikedByMe: Scalars['Boolean']['output'];
  /** Number of likes on this photo. */
  likeCount: Scalars['Int']['output'];
  /** Photo location with privacy-filtered coordinates. */
  location?: Maybe<PhotoLocation>;
  /** MIME type of the original file. */
  mimeType?: Maybe<Scalars['String']['output']>;
  /** Content moderation status. */
  moderationStatus: Scalars['String']['output'];
  /** Original image height in pixels. */
  originalHeight?: Maybe<Scalars['Int']['output']>;
  /** URL to the original uploaded image. */
  originalUrl: Scalars['String']['output'];
  /** Original image width in pixels. */
  originalWidth?: Maybe<Scalars['Int']['output']>;
  /** The person who took the photo (defaults to uploader). */
  photographer?: Maybe<User>;
  /** Name of the photographer. */
  photographerName?: Maybe<Scalars['String']['output']>;
  /** User-applied tags. */
  tags: Array<Scalars['String']['output']>;
  /** Date/time the photo was taken (from EXIF or user input). */
  takenAt?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
  /** The user who uploaded this photo. */
  user: User;
  /** Generated image variants (thumbnail, display, etc.). */
  variants: Array<PhotoVariant>;
};

/** Relay-style connection for paginated photo lists. */
export type PhotoConnection = {
  __typename?: 'PhotoConnection';
  edges: Array<PhotoEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type PhotoEdge = {
  __typename?: 'PhotoEdge';
  cursor: Scalars['String']['output'];
  node: Photo;
};

/** Location data for a photo, with privacy-filtered coordinates. */
export type PhotoLocation = {
  __typename?: 'PhotoLocation';
  /** Associated airport, if any. */
  airport?: Maybe<Airport>;
  id: Scalars['ID']['output'];
  /** Display latitude (may be jittered based on privacy mode). */
  latitude: Scalars['Float']['output'];
  /** Display longitude (may be jittered based on privacy mode). */
  longitude: Scalars['Float']['output'];
  /** Privacy mode: exact, approximate, or hidden. */
  privacyMode: Scalars['String']['output'];
  /** Associated spotting location, if any. */
  spottingLocation?: Maybe<SpottingLocation>;
};

/** Lightweight photo data for map markers. */
export type PhotoMapMarker = {
  __typename?: 'PhotoMapMarker';
  caption?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  latitude: Scalars['Float']['output'];
  longitude: Scalars['Float']['output'];
  thumbnailUrl?: Maybe<Scalars['String']['output']>;
};

export enum PhotoSortBy {
  PopularAll = 'popular_all',
  PopularDay = 'popular_day',
  PopularMonth = 'popular_month',
  PopularWeek = 'popular_week',
  Recent = 'recent'
}

/** A processed image variant (thumbnail, display, etc.). */
export type PhotoVariant = {
  __typename?: 'PhotoVariant';
  /** Variant file size in bytes. */
  fileSizeBytes?: Maybe<Scalars['Int']['output']>;
  /** Variant height in pixels. */
  height: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  /** URL to access this variant. */
  url: Scalars['String']['output'];
  /** The variant type: thumbnail, display, full_res, or watermarked. */
  variantType: Scalars['String']['output'];
  /** Variant width in pixels. */
  width: Scalars['Int']['output'];
};

/** A user's public profile with biographical and preference information. */
export type Profile = {
  __typename?: 'Profile';
  /** URL to the user's avatar image. */
  avatarUrl?: Maybe<Scalars['String']['output']>;
  /** Free-form biography text. */
  bio?: Maybe<Scalars['String']['output']>;
  /** Camera bodies in the user's gear list. */
  cameraBodies: Array<Scalars['String']['output']>;
  /** Display name shown on the profile page. */
  displayName?: Maybe<Scalars['String']['output']>;
  /** Self-reported experience level for aviation spotting. */
  experienceLevel?: Maybe<Scalars['String']['output']>;
  /** Favorite aircraft types (e.g., A380, 747, F-16). */
  favoriteAircraft: Array<Scalars['String']['output']>;
  /** Favorite airport codes. */
  favoriteAirports: Array<Scalars['String']['output']>;
  /** Camera/lens gear description. */
  gear?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** List of spotting interests (e.g., military, commercial, GA). */
  interests: Array<Scalars['String']['output']>;
  /** Whether this profile is publicly visible. */
  isPublic: Scalars['Boolean']['output'];
  /** Lenses in the user's gear list. */
  lenses: Array<Scalars['String']['output']>;
  /** Geographic region (e.g., 'Pacific Northwest, USA'). */
  locationRegion?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  /**
   * Paginated list of aircraft types for admin management.
   * Requires admin or moderator role.
   */
  adminAircraftTypes: AircraftTypeConnection;
  /** List all airports with optional search and pagination. Requires admin role. */
  adminAirports: AirportConnection;
  /**
   * Paginated list of photos filtered by moderation status.
   * Requires admin or moderator role.
   */
  adminPhotos: PhotoConnection;
  /**
   * Paginated list of reports, optionally filtered by status.
   * Requires admin or moderator role.
   */
  adminReports: ReportConnection;
  /** Dashboard statistics for admins. Requires admin or moderator role. */
  adminStats: AdminStats;
  /**
   * Paginated list of users for admin management.
   * Optionally filter by role or status, and search by username/email.
   * Requires admin or moderator role.
   */
  adminUsers: UserConnection;
  /** Fetch a single aircraft by registration. */
  aircraft?: Maybe<Aircraft>;
  /** Search canonical aircraft types from OpenFlights. */
  aircraftTypes: AircraftTypeConnection;
  /** Search aircraft by registration. Used for typeahead on the upload form. */
  aircrafts: AircraftConnection;
  /** Fetch a single airport by ICAO or IATA code. */
  airport?: Maybe<Airport>;
  /** List all airports. Used to populate map markers. */
  airports: Array<Airport>;
  /** Fetch a single album by ID. */
  album?: Maybe<Album>;
  /**
   * List albums for a specific user. If no userId is provided, returns the
   * authenticated user's albums.
   */
  albums: AlbumConnection;
  /** Paginated comments for a photo. Returns top-level comments with nested replies. */
  comments: CommentConnection;
  /** Browse/discover communities with optional search, category filter, and pagination. */
  communities: CommunityConnection;
  /** Find a community by its URL slug. */
  community?: Maybe<Community>;
  /** Fetch a single event by ID. */
  communityEvent?: Maybe<CommunityEvent>;
  /** List events for a community, ordered by startsAt asc. Defaults to upcoming only. */
  communityEvents: CommunityEventConnection;
  /** Paginated moderation log for a community. Requires owner or admin role. */
  communityModerationLogs: CommunityModerationLogConnection;
  /** Export all aircraft types as a flat list. Requires admin role. */
  exportAircraftTypes: Array<AircraftType>;
  /** Export all airports as a flat list. Requires admin role. */
  exportAirports: Array<Airport>;
  /**
   * Paginated feed of photos from followed users, airports, aircraft types,
   * and manufacturers. Requires authentication.
   */
  followingFeed: PhotoConnection;
  /** List all forum categories for a community, ordered by position. */
  forumCategories: Array<ForumCategory>;
  /** Fetch a single forum category by ID. */
  forumCategory?: Maybe<ForumCategory>;
  /** Paginated top-level posts in a thread, oldest first. */
  forumPosts: ForumPostConnection;
  /** Fetch a single forum thread by ID. */
  forumThread?: Maybe<ForumThread>;
  /** Paginated list of threads in a category. Pinned threads appear first. */
  forumThreads: ForumThreadConnection;
  /** List all global forum categories (not tied to any community), ordered by position. */
  globalForumCategories: Array<ForumCategory>;
  /** Health check — verifies the API is running and the database is reachable. */
  health: HealthCheck;
  /**
   * Fetch the currently authenticated user, including their profile.
   * Returns null if not authenticated.
   */
  me?: Maybe<User>;
  /** List communities the current user is a member of. */
  myCommunities: Array<Community>;
  /** List what the authenticated user is following. Optionally filter by target type. */
  myFollowing: Array<FollowEntry>;
  /** Paginated list of the current user's notifications, newest first. */
  notifications: NotificationConnection;
  /** Fetch a single photo by ID. Returns null if not found. */
  photo?: Maybe<Photo>;
  /**
   * Paginated, filterable photo feed. Supports cursor-based pagination
   * and filtering by user, album, aircraft type, airport, and tags.
   */
  photos: PhotoConnection;
  /**
   * Fetch photos within a geographic bounding box.
   * Uses PostGIS for spatial query.
   */
  photosInBounds: Array<PhotoMapMarker>;
  /**
   * Fetch photos near a point within a radius (in meters).
   * Uses PostGIS ST_DWithin for spatial query.
   */
  photosNearby: Array<PhotoMapMarker>;
  /** Distinct airline names matching a search string, for typeahead dropdowns. */
  searchAirlines: Array<Scalars['String']['output']>;
  /** Minimal airport result for typeahead search — omits expensive relations. */
  searchAirports: Array<AirportSearchResult>;
  /**
   * Search photos by free text. Matches against caption, aircraft type,
   * airline, airport code, and tags. Results ordered by relevance.
   */
  searchPhotos: PhotoConnection;
  /** Search users by username or display name. */
  searchUsers: UserConnection;
  /** Fetch site-wide settings (banner, tagline). Returns null if not set. */
  siteSettings?: Maybe<SiteSettings>;
  /** Count of unread notifications for the current user. Returns 0 if unauthenticated. */
  unreadNotificationCount: Scalars['Int']['output'];
  /**
   * Fetch a user by their unique username.
   * Returns null if the user does not exist or their profile is private.
   */
  user?: Maybe<User>;
  /** Paginated list of users. Supports cursor-based pagination. */
  users: UserConnection;
};


export type QueryAdminAircraftTypesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminAirportsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminPhotosArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  moderationStatus?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminReportsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminUsersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAircraftArgs = {
  registration: Scalars['String']['input'];
};


export type QueryAircraftTypesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAircraftsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAirportArgs = {
  code: Scalars['String']['input'];
};


export type QueryAlbumArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAlbumsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryCommentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  photoId: Scalars['ID']['input'];
};


export type QueryCommunitiesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCommunityArgs = {
  slug: Scalars['String']['input'];
};


export type QueryCommunityEventArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCommunityEventsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  communityId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  includePast?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryCommunityModerationLogsArgs = {
  action?: InputMaybe<Scalars['String']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  communityId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFollowingFeedArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryForumCategoriesArgs = {
  communityId: Scalars['ID']['input'];
};


export type QueryForumCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryForumPostsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  threadId: Scalars['ID']['input'];
};


export type QueryForumThreadArgs = {
  id: Scalars['ID']['input'];
};


export type QueryForumThreadsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  categoryId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyFollowingArgs = {
  targetType?: InputMaybe<Scalars['String']['input']>;
};


export type QueryNotificationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  unreadOnly?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryPhotoArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPhotosArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  aircraftType?: InputMaybe<Scalars['String']['input']>;
  airline?: InputMaybe<Scalars['String']['input']>;
  airportCode?: InputMaybe<Scalars['String']['input']>;
  albumId?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  photographer?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<PhotoSortBy>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryPhotosInBoundsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  neLat: Scalars['Float']['input'];
  neLng: Scalars['Float']['input'];
  swLat: Scalars['Float']['input'];
  swLng: Scalars['Float']['input'];
};


export type QueryPhotosNearbyArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  latitude: Scalars['Float']['input'];
  longitude: Scalars['Float']['input'];
  radiusMeters?: InputMaybe<Scalars['Float']['input']>;
};


export type QuerySearchAirlinesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type QuerySearchAirportsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type QuerySearchPhotosArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type QuerySearchUsersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type QueryUserArgs = {
  username: Scalars['String']['input'];
};


export type QueryUsersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

/** A content moderation report. */
export type Report = {
  __typename?: 'Report';
  createdAt: Scalars['String']['output'];
  /** Optional description providing additional context. */
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** The reason for the report. */
  reason: Scalars['String']['output'];
  /** The user who submitted the report. */
  reporter: User;
  /** When the report was resolved. */
  resolvedAt?: Maybe<Scalars['String']['output']>;
  /** The admin/moderator who reviewed the report. */
  reviewer?: Maybe<User>;
  /** Current status of the report. */
  status: Scalars['String']['output'];
  /** The ID of the reported content. */
  targetId: Scalars['ID']['output'];
  /** The type of content being reported. */
  targetType: Scalars['String']['output'];
};

export type ReportConnection = {
  __typename?: 'ReportConnection';
  edges: Array<ReportEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ReportEdge = {
  __typename?: 'ReportEdge';
  cursor: Scalars['String']['output'];
  node: Report;
};

export type SignInInput = {
  /** Email address. */
  email: Scalars['String']['input'];
  /** Password. */
  password: Scalars['String']['input'];
};

export type SignUpInput = {
  /** Email address for the new account. */
  email: Scalars['String']['input'];
  /** Password (min 8 characters). */
  password: Scalars['String']['input'];
  /** Unique username (3-30 chars, alphanumeric + hyphens/underscores). */
  username: Scalars['String']['input'];
};

export type SiteSettings = {
  __typename?: 'SiteSettings';
  bannerUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  tagline?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

/** A known spotting location near an airport. */
export type SpottingLocation = {
  __typename?: 'SpottingLocation';
  accessNotes?: Maybe<Scalars['String']['output']>;
  createdBy: User;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  latitude: Scalars['Float']['output'];
  longitude: Scalars['Float']['output'];
  name: Scalars['String']['output'];
};

export type UpdateAircraftInput = {
  aircraftType?: InputMaybe<Scalars['String']['input']>;
  aircraftTypeId?: InputMaybe<Scalars['ID']['input']>;
  airline?: InputMaybe<Scalars['String']['input']>;
  manufacturingDate?: InputMaybe<Scalars['String']['input']>;
  msn?: InputMaybe<Scalars['String']['input']>;
  registration?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAircraftTypeInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  engineCount?: InputMaybe<Scalars['Int']['input']>;
  engineType?: InputMaybe<Scalars['String']['input']>;
  iataCode?: InputMaybe<Scalars['String']['input']>;
  icaoCode?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  vendor?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAirportInput = {
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  iataCode?: InputMaybe<Scalars['String']['input']>;
  icaoCode?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAlbumInput = {
  /** Set the cover photo. Must be a photo in this album. */
  coverPhotoId?: InputMaybe<Scalars['ID']['input']>;
  /** New description. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Toggle album visibility. */
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** New title for the album. */
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCommunityEventInput = {
  coverUrl?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  endsAt?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  maxAttendees?: InputMaybe<Scalars['Int']['input']>;
  startsAt?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCommunityInput = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  bannerUrl?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePhotoInput = {
  aircraftId?: InputMaybe<Scalars['ID']['input']>;
  aircraftType?: InputMaybe<Scalars['String']['input']>;
  aircraftTypeId?: InputMaybe<Scalars['ID']['input']>;
  airline?: InputMaybe<Scalars['String']['input']>;
  airportCode?: InputMaybe<Scalars['String']['input']>;
  caption?: InputMaybe<Scalars['String']['input']>;
  gearBody?: InputMaybe<Scalars['String']['input']>;
  gearLens?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  locationPrivacy?: InputMaybe<Scalars['String']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  takenAt?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateProfileInput = {
  bio?: InputMaybe<Scalars['String']['input']>;
  cameraBodies?: InputMaybe<Array<Scalars['String']['input']>>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  experienceLevel?: InputMaybe<Scalars['String']['input']>;
  favoriteAircraft?: InputMaybe<Array<Scalars['String']['input']>>;
  favoriteAirports?: InputMaybe<Array<Scalars['String']['input']>>;
  gear?: InputMaybe<Scalars['String']['input']>;
  interests?: InputMaybe<Array<Scalars['String']['input']>>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  lenses?: InputMaybe<Array<Scalars['String']['input']>>;
  locationRegion?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSiteSettingsInput = {
  bannerUrl?: InputMaybe<Scalars['String']['input']>;
  tagline?: InputMaybe<Scalars['String']['input']>;
};

/** Presigned URL payload for client-side S3 upload. */
export type UploadUrlPayload = {
  __typename?: 'UploadUrlPayload';
  /** S3 object key — pass this to createPhoto after upload completes. */
  key: Scalars['String']['output'];
  /** Presigned PUT URL — upload the file directly to this URL. */
  url: Scalars['String']['output'];
};

/** A registered SpotterSpace user. */
export type User = {
  __typename?: 'User';
  createdAt: Scalars['String']['output'];
  /** Unique email address. */
  email: Scalars['String']['output'];
  /** Number of users following this user. */
  followerCount: Scalars['Int']['output'];
  /** Number of users this user follows. */
  followingCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  /** Whether the currently authenticated user follows this user. */
  isFollowedByMe: Scalars['Boolean']['output'];
  /** Number of photos uploaded by this user. */
  photoCount: Scalars['Int']['output'];
  /** The user's profile, if one has been created. */
  profile?: Maybe<Profile>;
  /** Platform role: user, moderator, or admin. */
  role: Scalars['String']['output'];
  /** Account status: active, suspended, or banned. */
  status: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  /** Unique username, used in profile URLs (/u/username). */
  username: Scalars['String']['output'];
};

/** Relay-style connection for paginated user lists. */
export type UserConnection = {
  __typename?: 'UserConnection';
  edges: Array<UserEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type UserEdge = {
  __typename?: 'UserEdge';
  cursor: Scalars['String']['output'];
  node: User;
};

export type SignUpMutationVariables = Exact<{
  input: SignUpInput;
}>;


export type SignUpMutation = { __typename?: 'Mutation', signUp: { __typename?: 'AuthPayload', token: string, user: { __typename?: 'User', id: string, email: string, username: string, role: string } } };

export type SignInMutationVariables = Exact<{
  input: SignInInput;
}>;


export type SignInMutation = { __typename?: 'Mutation', signIn: { __typename?: 'AuthPayload', token: string, user: { __typename?: 'User', id: string, email: string, username: string, role: string } } };

export type RequestPasswordResetMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type RequestPasswordResetMutation = { __typename?: 'Mutation', requestPasswordReset: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', resetPassword: { __typename?: 'AuthPayload', token: string, user: { __typename?: 'User', id: string, email: string, username: string, role: string } } };

export type PhotoFieldsFragment = { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null };

export type PhotosQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  albumId?: InputMaybe<Scalars['ID']['input']>;
  aircraftType?: InputMaybe<Scalars['String']['input']>;
  airportCode?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  airline?: InputMaybe<Scalars['String']['input']>;
  photographer?: InputMaybe<Scalars['String']['input']>;
  sortBy?: InputMaybe<PhotoSortBy>;
}>;


export type PhotosQuery = { __typename?: 'Query', photos: { __typename?: 'PhotoConnection', totalCount: number, edges: Array<{ __typename?: 'PhotoEdge', cursor: string, node: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type PhotoQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type PhotoQuery = { __typename?: 'Query', photo?: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } | null };

export type GetUploadUrlMutationVariables = Exact<{
  input: GetUploadUrlInput;
}>;


export type GetUploadUrlMutation = { __typename?: 'Mutation', getUploadUrl: { __typename?: 'UploadUrlPayload', url: string, key: string } };

export type CreatePhotoMutationVariables = Exact<{
  input: CreatePhotoInput;
}>;


export type CreatePhotoMutation = { __typename?: 'Mutation', createPhoto: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } };

export type LikePhotoMutationVariables = Exact<{
  photoId: Scalars['ID']['input'];
}>;


export type LikePhotoMutation = { __typename?: 'Mutation', likePhoto: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } };

export type UnlikePhotoMutationVariables = Exact<{
  photoId: Scalars['ID']['input'];
}>;


export type UnlikePhotoMutation = { __typename?: 'Mutation', unlikePhoto: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } };

export type UserQueryVariables = Exact<{
  username: Scalars['String']['input'];
}>;


export type UserQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: string, username: string, role: string, photoCount: number, followerCount: number, followingCount: number, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, bio?: string | null, avatarUrl?: string | null, locationRegion?: string | null, experienceLevel?: string | null, gear?: string | null, interests: Array<string>, favoriteAircraft: Array<string>, favoriteAirports: Array<string>, isPublic: boolean, cameraBodies: Array<string>, lenses: Array<string> } | null } | null };

export type FollowUserMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type FollowUserMutation = { __typename?: 'Mutation', followUser: { __typename?: 'User', id: string, followerCount: number, isFollowedByMe: boolean } };

export type UnfollowUserMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type UnfollowUserMutation = { __typename?: 'Mutation', unfollowUser: { __typename?: 'User', id: string, followerCount: number, isFollowedByMe: boolean } };

export type CommentsQueryVariables = Exact<{
  photoId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type CommentsQuery = { __typename?: 'Query', comments: { __typename?: 'CommentConnection', totalCount: number, edges: Array<{ __typename?: 'CommentEdge', cursor: string, node: { __typename?: 'Comment', id: string, body: string, createdAt: string, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, replies: Array<{ __typename?: 'Comment', id: string, body: string, createdAt: string, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } }> } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type AddCommentMutationVariables = Exact<{
  input: AddCommentInput;
}>;


export type AddCommentMutation = { __typename?: 'Mutation', addComment: { __typename?: 'Comment', id: string, body: string, createdAt: string, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, replies: Array<{ __typename?: 'Comment', id: string, body: string, createdAt: string, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } }> } };

export type DeleteCommentMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteCommentMutation = { __typename?: 'Mutation', deleteComment: boolean };

export type CreateReportMutationVariables = Exact<{
  input: CreateReportInput;
}>;


export type CreateReportMutation = { __typename?: 'Mutation', createReport: { __typename?: 'Report', id: string, status: string } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'User', id: string, email: string, username: string, role: string, photoCount: number, profile?: { __typename?: 'Profile', displayName?: string | null, bio?: string | null, avatarUrl?: string | null, locationRegion?: string | null, experienceLevel?: string | null, gear?: string | null, interests: Array<string>, favoriteAircraft: Array<string>, favoriteAirports: Array<string>, isPublic: boolean, cameraBodies: Array<string>, lenses: Array<string> } | null } | null };

export type UpdateProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateProfileMutation = { __typename?: 'Mutation', updateProfile: { __typename?: 'Profile', displayName?: string | null, bio?: string | null, avatarUrl?: string | null, locationRegion?: string | null, experienceLevel?: string | null, gear?: string | null, interests: Array<string>, favoriteAircraft: Array<string>, favoriteAirports: Array<string>, isPublic: boolean, cameraBodies: Array<string>, lenses: Array<string> } };

export type UpdateAvatarMutationVariables = Exact<{
  avatarUrl: Scalars['String']['input'];
}>;


export type UpdateAvatarMutation = { __typename?: 'Mutation', updateAvatar: { __typename?: 'Profile', avatarUrl?: string | null } };

export type SearchPhotosQueryVariables = Exact<{
  query: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type SearchPhotosQuery = { __typename?: 'Query', searchPhotos: { __typename?: 'PhotoConnection', totalCount: number, edges: Array<{ __typename?: 'PhotoEdge', cursor: string, node: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type SearchUsersQueryVariables = Exact<{
  query: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type SearchUsersQuery = { __typename?: 'Query', searchUsers: { __typename?: 'UserConnection', totalCount: number, edges: Array<{ __typename?: 'UserEdge', cursor: string, node: { __typename?: 'User', id: string, username: string, photoCount: number, followerCount: number, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null, bio?: string | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type SearchAirlinesQueryVariables = Exact<{
  query: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchAirlinesQuery = { __typename?: 'Query', searchAirlines: Array<string> };

export type SearchAirportsQueryVariables = Exact<{
  query: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchAirportsQuery = { __typename?: 'Query', searchAirports: Array<{ __typename?: 'AirportSearchResult', icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null }> };

export type SearchAircraftTypesQueryVariables = Exact<{
  search: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchAircraftTypesQuery = { __typename?: 'Query', aircraftTypes: { __typename?: 'AircraftTypeConnection', edges: Array<{ __typename?: 'AircraftTypeEdge', cursor: string, node: { __typename?: 'AircraftType', id: string, iataCode?: string | null, icaoCode?: string | null, vendor: string, model: string, category?: string | null, engineType?: string | null, engineCount?: number | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type AirportsQueryVariables = Exact<{ [key: string]: never; }>;


export type AirportsQuery = { __typename?: 'Query', airports: Array<{ __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, latitude: number, longitude: number, photoCount: number }> };

export type AirportQueryVariables = Exact<{
  code: Scalars['String']['input'];
}>;


export type AirportQuery = { __typename?: 'Query', airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, latitude: number, longitude: number, photoCount: number, isFollowedByMe: boolean, followerCount: number, spottingLocations: Array<{ __typename?: 'SpottingLocation', id: string, name: string, description?: string | null, accessNotes?: string | null, latitude: number, longitude: number }> } | null };

export type PhotosInBoundsQueryVariables = Exact<{
  swLat: Scalars['Float']['input'];
  swLng: Scalars['Float']['input'];
  neLat: Scalars['Float']['input'];
  neLng: Scalars['Float']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type PhotosInBoundsQuery = { __typename?: 'Query', photosInBounds: Array<{ __typename?: 'PhotoMapMarker', id: string, latitude: number, longitude: number, thumbnailUrl?: string | null, caption?: string | null }> };

export type PhotosNearbyQueryVariables = Exact<{
  latitude: Scalars['Float']['input'];
  longitude: Scalars['Float']['input'];
  radiusMeters?: InputMaybe<Scalars['Float']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
}>;


export type PhotosNearbyQuery = { __typename?: 'Query', photosNearby: Array<{ __typename?: 'PhotoMapMarker', id: string, latitude: number, longitude: number, thumbnailUrl?: string | null, caption?: string | null }> };

export type CreateSpottingLocationMutationVariables = Exact<{
  input: CreateSpottingLocationInput;
}>;


export type CreateSpottingLocationMutation = { __typename?: 'Mutation', createSpottingLocation: { __typename?: 'SpottingLocation', id: string, name: string, description?: string | null, accessNotes?: string | null, latitude: number, longitude: number, createdBy: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null } | null } } };

export type DeleteSpottingLocationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteSpottingLocationMutation = { __typename?: 'Mutation', deleteSpottingLocation: boolean };

export type AlbumFieldsFragment = { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null };

export type AlbumQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type AlbumQuery = { __typename?: 'Query', album?: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, myMembership?: { __typename?: 'CommunityMember', id: string, role: string, status: string } | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } | null };

export type AlbumsQueryVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type AlbumsQuery = { __typename?: 'Query', albums: { __typename?: 'AlbumConnection', totalCount: number, edges: Array<{ __typename?: 'AlbumEdge', cursor: string, node: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type CreateAlbumMutationVariables = Exact<{
  input: CreateAlbumInput;
}>;


export type CreateAlbumMutation = { __typename?: 'Mutation', createAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type UpdateAlbumMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAlbumInput;
}>;


export type UpdateAlbumMutation = { __typename?: 'Mutation', updateAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type DeleteAlbumMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAlbumMutation = { __typename?: 'Mutation', deleteAlbum: boolean };

export type AddPhotosToAlbumMutationVariables = Exact<{
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type AddPhotosToAlbumMutation = { __typename?: 'Mutation', addPhotosToAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type RemovePhotosFromAlbumMutationVariables = Exact<{
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type RemovePhotosFromAlbumMutation = { __typename?: 'Mutation', removePhotosFromAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type CreateCommunityAlbumMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
  input: CreateAlbumInput;
}>;


export type CreateCommunityAlbumMutation = { __typename?: 'Mutation', createCommunityAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type AddPhotosToCommunityAlbumMutationVariables = Exact<{
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type AddPhotosToCommunityAlbumMutation = { __typename?: 'Mutation', addPhotosToCommunityAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type RemovePhotosFromCommunityAlbumMutationVariables = Exact<{
  albumId: Scalars['ID']['input'];
  photoIds: Array<Scalars['ID']['input']> | Scalars['ID']['input'];
}>;


export type RemovePhotosFromCommunityAlbumMutation = { __typename?: 'Mutation', removePhotosFromCommunityAlbum: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } };

export type FollowAirportMutationVariables = Exact<{
  airportId: Scalars['ID']['input'];
}>;


export type FollowAirportMutation = { __typename?: 'Mutation', followAirport: { __typename?: 'Airport', id: string, isFollowedByMe: boolean, followerCount: number } };

export type UnfollowAirportMutationVariables = Exact<{
  airportId: Scalars['ID']['input'];
}>;


export type UnfollowAirportMutation = { __typename?: 'Mutation', unfollowAirport: { __typename?: 'Airport', id: string, isFollowedByMe: boolean, followerCount: number } };

export type FollowTopicMutationVariables = Exact<{
  targetType: Scalars['String']['input'];
  value: Scalars['String']['input'];
}>;


export type FollowTopicMutation = { __typename?: 'Mutation', followTopic: { __typename?: 'FollowedTopic', targetType: string, value: string } };

export type UnfollowTopicMutationVariables = Exact<{
  targetType: Scalars['String']['input'];
  value: Scalars['String']['input'];
}>;


export type UnfollowTopicMutation = { __typename?: 'Mutation', unfollowTopic: { __typename?: 'FollowedTopic', targetType: string, value: string } };

export type MyFollowingQueryVariables = Exact<{
  targetType?: InputMaybe<Scalars['String']['input']>;
}>;


export type MyFollowingQuery = { __typename?: 'Query', myFollowing: Array<{ __typename?: 'FollowEntry', id: string, targetType: string, targetValue?: string | null, createdAt: string, user?: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, isFollowedByMe: boolean, followerCount: number } | null }> };

export type FollowingFeedQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type FollowingFeedQuery = { __typename?: 'Query', followingFeed: { __typename?: 'PhotoConnection', totalCount: number, edges: Array<{ __typename?: 'PhotoEdge', cursor: string, node: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type AdminStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminStatsQuery = { __typename?: 'Query', adminStats: { __typename?: 'AdminStats', totalUsers: number, totalPhotos: number, pendingPhotos: number, openReports: number, totalAirports: number, totalSpottingLocations: number } };

export type AdminReportsQueryVariables = Exact<{
  status?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type AdminReportsQuery = { __typename?: 'Query', adminReports: { __typename?: 'ReportConnection', totalCount: number, edges: Array<{ __typename?: 'ReportEdge', cursor: string, node: { __typename?: 'Report', id: string, targetType: string, targetId: string, reason: string, description?: string | null, status: string, createdAt: string, resolvedAt?: string | null, reporter: { __typename?: 'User', id: string, username: string }, reviewer?: { __typename?: 'User', id: string, username: string } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type AdminUsersQueryVariables = Exact<{
  role?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type AdminUsersQuery = { __typename?: 'Query', adminUsers: { __typename?: 'UserConnection', totalCount: number, edges: Array<{ __typename?: 'UserEdge', cursor: string, node: { __typename?: 'User', id: string, username: string, email: string, role: string, status: string, createdAt: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type AdminPhotosQueryVariables = Exact<{
  moderationStatus?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type AdminPhotosQuery = { __typename?: 'Query', adminPhotos: { __typename?: 'PhotoConnection', totalCount: number, edges: Array<{ __typename?: 'PhotoEdge', cursor: string, node: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type AdminAircraftTypesQueryVariables = Exact<{
  search?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type AdminAircraftTypesQuery = { __typename?: 'Query', adminAircraftTypes: { __typename?: 'AircraftTypeConnection', totalCount: number, edges: Array<{ __typename?: 'AircraftTypeEdge', cursor: string, node: { __typename?: 'AircraftType', id: string, iataCode?: string | null, icaoCode?: string | null, vendor: string, model: string, category?: string | null, engineType?: string | null, engineCount?: number | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type DeleteAircraftTypeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAircraftTypeMutation = { __typename?: 'Mutation', deleteAircraftType: boolean };

export type CreateAircraftTypeMutationVariables = Exact<{
  input: CreateAircraftTypeInput;
}>;


export type CreateAircraftTypeMutation = { __typename?: 'Mutation', createAircraftType: { __typename?: 'AircraftType', id: string } };

export type UpdateAircraftTypeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAircraftTypeInput;
}>;


export type UpdateAircraftTypeMutation = { __typename?: 'Mutation', updateAircraftType: { __typename?: 'AircraftType', id: string } };

export type UpsertAircraftTypeMutationVariables = Exact<{
  input: CreateAircraftTypeInput;
}>;


export type UpsertAircraftTypeMutation = { __typename?: 'Mutation', upsertAircraftType: { __typename?: 'AircraftType', id: string } };

export type AdminAirportsQueryVariables = Exact<{
  search?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type AdminAirportsQuery = { __typename?: 'Query', adminAirports: { __typename?: 'AirportConnection', totalCount: number, edges: Array<{ __typename?: 'AirportEdge', cursor: string, node: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, latitude: number, longitude: number } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type ExportAircraftTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type ExportAircraftTypesQuery = { __typename?: 'Query', exportAircraftTypes: Array<{ __typename?: 'AircraftType', id: string, iataCode?: string | null, icaoCode?: string | null, vendor: string, model: string, category?: string | null, engineType?: string | null, engineCount?: number | null }> };

export type ExportAirportsQueryVariables = Exact<{ [key: string]: never; }>;


export type ExportAirportsQuery = { __typename?: 'Query', exportAirports: Array<{ __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, latitude: number, longitude: number }> };

export type CreateAirportMutationVariables = Exact<{
  input: CreateAirportInput;
}>;


export type CreateAirportMutation = { __typename?: 'Mutation', createAirport: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, latitude: number, longitude: number } };

export type UpdateAirportMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateAirportInput;
}>;


export type UpdateAirportMutation = { __typename?: 'Mutation', updateAirport: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string, city?: string | null, country?: string | null, latitude: number, longitude: number } };

export type UpsertAirportMutationVariables = Exact<{
  input: CreateAirportInput;
}>;


export type UpsertAirportMutation = { __typename?: 'Mutation', upsertAirport: { __typename?: 'Airport', id: string } };

export type DeleteAirportMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteAirportMutation = { __typename?: 'Mutation', deleteAirport: boolean };

export type AdminResolveReportMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  action: Scalars['String']['input'];
}>;


export type AdminResolveReportMutation = { __typename?: 'Mutation', adminResolveReport: { __typename?: 'Report', id: string, status: string, resolvedAt?: string | null } };

export type AdminUpdateUserStatusMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  status: Scalars['String']['input'];
}>;


export type AdminUpdateUserStatusMutation = { __typename?: 'Mutation', adminUpdateUserStatus: { __typename?: 'User', id: string, status: string } };

export type AdminUpdateUserRoleMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  role: Scalars['String']['input'];
}>;


export type AdminUpdateUserRoleMutation = { __typename?: 'Mutation', adminUpdateUserRole: { __typename?: 'User', id: string, role: string } };

export type AdminUpdatePhotoModerationMutationVariables = Exact<{
  photoId: Scalars['ID']['input'];
  status: Scalars['String']['input'];
}>;


export type AdminUpdatePhotoModerationMutation = { __typename?: 'Mutation', adminUpdatePhotoModeration: { __typename?: 'Photo', id: string, moderationStatus: string } };

export type CommunityQueryVariables = Exact<{
  slug: Scalars['String']['input'];
}>;


export type CommunityQuery = { __typename?: 'Query', community?: { __typename?: 'Community', id: string, name: string, slug: string, description?: string | null, bannerUrl?: string | null, avatarUrl?: string | null, category?: string | null, visibility: string, location?: string | null, inviteCode?: string | null, createdAt: string, memberCount: number, owner: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, myMembership?: { __typename?: 'CommunityMember', id: string, role: string, status: string } | null, members: { __typename?: 'CommunityMemberConnection', totalCount: number, edges: Array<{ __typename?: 'CommunityMemberEdge', node: { __typename?: 'CommunityMember', id: string, role: string, status: string, joinedAt: string, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } }, photos: { __typename?: 'PhotoConnection', totalCount: number, edges: Array<{ __typename?: 'PhotoEdge', cursor: string, node: { __typename?: 'Photo', id: string, caption?: string | null, aircraftType?: string | null, airline?: string | null, airportCode?: string | null, takenAt?: string | null, originalUrl: string, originalWidth?: number | null, originalHeight?: number | null, fileSizeBytes?: number | null, mimeType?: string | null, moderationStatus: string, tags: Array<string>, likeCount: number, commentCount: number, isLikedByMe: boolean, createdAt: string, photographerName?: string | null, gearBody?: string | null, gearLens?: string | null, aircraft?: { __typename?: 'Aircraft', id: string, registration: string, aircraftType: string, airline?: string | null, msn?: string | null, manufacturingDate?: string | null } | null, photographer?: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } | null, user: { __typename?: 'User', id: string, username: string, isFollowedByMe: boolean, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, variants: Array<{ __typename?: 'PhotoVariant', id: string, variantType: string, url: string, width: number, height: number }>, location?: { __typename?: 'PhotoLocation', id: string, latitude: number, longitude: number, privacyMode: string, airport?: { __typename?: 'Airport', id: string, icaoCode: string, iataCode?: string | null, name: string } | null, spottingLocation?: { __typename?: 'SpottingLocation', id: string, name: string } | null } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } }, albums: { __typename?: 'AlbumConnection', totalCount: number, edges: Array<{ __typename?: 'AlbumEdge', node: { __typename?: 'Album', id: string, title: string, description?: string | null, isPublic: boolean, photoCount: number, createdAt: string, updatedAt: string, communityId?: string | null, community?: { __typename?: 'Community', id: string, name: string, slug: string } | null, user: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, coverPhoto?: { __typename?: 'Photo', id: string, variants: Array<{ __typename?: 'PhotoVariant', variantType: string, url: string, width: number, height: number }> } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } } | null };

export type CommunitiesQueryVariables = Exact<{
  search?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type CommunitiesQuery = { __typename?: 'Query', communities: { __typename?: 'CommunityConnection', totalCount: number, edges: Array<{ __typename?: 'CommunityEdge', cursor: string, node: { __typename?: 'Community', id: string, name: string, slug: string, description?: string | null, category?: string | null, avatarUrl?: string | null, location?: string | null, memberCount: number, owner: { __typename?: 'User', username: string } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type MyCommunitiesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyCommunitiesQuery = { __typename?: 'Query', myCommunities: Array<{ __typename?: 'Community', id: string, name: string, slug: string, avatarUrl?: string | null, memberCount: number }> };

export type CreateCommunityMutationVariables = Exact<{
  input: CreateCommunityInput;
}>;


export type CreateCommunityMutation = { __typename?: 'Mutation', createCommunity: { __typename?: 'Community', id: string, slug: string } };

export type JoinCommunityMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
  inviteCode?: InputMaybe<Scalars['String']['input']>;
}>;


export type JoinCommunityMutation = { __typename?: 'Mutation', joinCommunity: { __typename?: 'CommunityMember', id: string, role: string } };

export type LeaveCommunityMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
}>;


export type LeaveCommunityMutation = { __typename?: 'Mutation', leaveCommunity: boolean };

export type UpdateCommunityMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateCommunityInput;
}>;


export type UpdateCommunityMutation = { __typename?: 'Mutation', updateCommunity: { __typename?: 'Community', id: string, name: string, slug: string, description?: string | null, category?: string | null, visibility: string, location?: string | null } };

export type DeleteCommunityMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteCommunityMutation = { __typename?: 'Mutation', deleteCommunity: boolean };

export type GenerateInviteCodeMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
}>;


export type GenerateInviteCodeMutation = { __typename?: 'Mutation', generateInviteCode: { __typename?: 'Community', id: string, inviteCode?: string | null } };

export type BanCommunityMemberMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
}>;


export type BanCommunityMemberMutation = { __typename?: 'Mutation', banCommunityMember: { __typename?: 'CommunityMember', id: string, status: string, role: string } };

export type UnbanCommunityMemberMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
}>;


export type UnbanCommunityMemberMutation = { __typename?: 'Mutation', unbanCommunityMember: { __typename?: 'CommunityMember', id: string, status: string, role: string } };

export type RemoveCommunityMemberMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
}>;


export type RemoveCommunityMemberMutation = { __typename?: 'Mutation', removeCommunityMember: boolean };

export type CommunityModerationLogsQueryVariables = Exact<{
  communityId: Scalars['ID']['input'];
  action?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type CommunityModerationLogsQuery = { __typename?: 'Query', communityModerationLogs: { __typename?: 'CommunityModerationLogConnection', totalCount: number, edges: Array<{ __typename?: 'CommunityModerationLogEdge', cursor: string, node: { __typename?: 'CommunityModerationLog', id: string, action: string, reason?: string | null, metadata?: any | null, createdAt: string, moderator: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, targetUser: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type ForumCategoriesQueryVariables = Exact<{
  communityId: Scalars['ID']['input'];
}>;


export type ForumCategoriesQuery = { __typename?: 'Query', forumCategories: Array<{ __typename?: 'ForumCategory', id: string, name: string, description?: string | null, slug: string, position: number, threadCount: number, latestThread?: { __typename?: 'ForumThread', id: string, title: string, lastPostAt: string, author: { __typename?: 'User', username: string } } | null }> };

export type ForumThreadsQueryVariables = Exact<{
  categoryId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type ForumThreadsQuery = { __typename?: 'Query', forumThreads: { __typename?: 'ForumThreadConnection', totalCount: number, edges: Array<{ __typename?: 'ForumThreadEdge', cursor: string, node: { __typename?: 'ForumThread', id: string, title: string, isPinned: boolean, isLocked: boolean, postCount: number, lastPostAt: string, createdAt: string, author: { __typename?: 'User', username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, firstPost?: { __typename?: 'ForumPost', body: string } | null } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type ForumThreadQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ForumThreadQuery = { __typename?: 'Query', forumThread?: { __typename?: 'ForumThread', id: string, title: string, isPinned: boolean, isLocked: boolean, postCount: number, lastPostAt: string, createdAt: string, author: { __typename?: 'User', username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, category: { __typename?: 'ForumCategory', id: string, name: string, slug: string, communityId?: string | null } } | null };

export type ForumPostsQueryVariables = Exact<{
  threadId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;


export type ForumPostsQuery = { __typename?: 'Query', forumPosts: { __typename?: 'ForumPostConnection', totalCount: number, edges: Array<{ __typename?: 'ForumPostEdge', cursor: string, node: { __typename?: 'ForumPost', id: string, body: string, isDeleted: boolean, createdAt: string, updatedAt: string, author: { __typename?: 'User', username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, replies: Array<{ __typename?: 'ForumPost', id: string, body: string, isDeleted: boolean, createdAt: string, author: { __typename?: 'User', username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } }> } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type CreateForumCategoryMutationVariables = Exact<{
  communityId?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateForumCategoryMutation = { __typename?: 'Mutation', createForumCategory: { __typename?: 'ForumCategory', id: string, name: string, slug: string, description?: string | null, position: number, threadCount: number } };

export type UpdateForumCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
}>;


export type UpdateForumCategoryMutation = { __typename?: 'Mutation', updateForumCategory: { __typename?: 'ForumCategory', id: string, name: string, description?: string | null, position: number } };

export type DeleteForumCategoryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteForumCategoryMutation = { __typename?: 'Mutation', deleteForumCategory: boolean };

export type CreateForumThreadMutationVariables = Exact<{
  categoryId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
  body: Scalars['String']['input'];
}>;


export type CreateForumThreadMutation = { __typename?: 'Mutation', createForumThread: { __typename?: 'ForumThread', id: string, title: string, isPinned: boolean, isLocked: boolean, postCount: number, createdAt: string, author: { __typename?: 'User', username: string } } };

export type DeleteForumThreadMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteForumThreadMutation = { __typename?: 'Mutation', deleteForumThread: boolean };

export type PinForumThreadMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  pinned: Scalars['Boolean']['input'];
}>;


export type PinForumThreadMutation = { __typename?: 'Mutation', pinForumThread: { __typename?: 'ForumThread', id: string, isPinned: boolean } };

export type LockForumThreadMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  locked: Scalars['Boolean']['input'];
}>;


export type LockForumThreadMutation = { __typename?: 'Mutation', lockForumThread: { __typename?: 'ForumThread', id: string, isLocked: boolean } };

export type CreateForumPostMutationVariables = Exact<{
  threadId: Scalars['ID']['input'];
  body: Scalars['String']['input'];
  parentPostId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type CreateForumPostMutation = { __typename?: 'Mutation', createForumPost: { __typename?: 'ForumPost', id: string, body: string, isDeleted: boolean, createdAt: string, author: { __typename?: 'User', username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null }, replies: Array<{ __typename?: 'ForumPost', id: string, body: string, isDeleted: boolean, createdAt: string, author: { __typename?: 'User', username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } }> } };

export type UpdateForumPostMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  body: Scalars['String']['input'];
}>;


export type UpdateForumPostMutation = { __typename?: 'Mutation', updateForumPost: { __typename?: 'ForumPost', id: string, body: string } };

export type GlobalForumCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GlobalForumCategoriesQuery = { __typename?: 'Query', globalForumCategories: Array<{ __typename?: 'ForumCategory', id: string, name: string, description?: string | null, slug: string, position: number, threadCount: number, latestThread?: { __typename?: 'ForumThread', id: string, title: string, lastPostAt: string, author: { __typename?: 'User', username: string } } | null }> };

export type CreateGlobalForumCategoryMutationVariables = Exact<{
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateGlobalForumCategoryMutation = { __typename?: 'Mutation', createGlobalForumCategory: { __typename?: 'ForumCategory', id: string, name: string, slug: string, description?: string | null, position: number, threadCount: number } };

export type DeleteForumPostMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteForumPostMutation = { __typename?: 'Mutation', deleteForumPost: boolean };

export type GetCommunityEventsQueryVariables = Exact<{
  communityId: Scalars['ID']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  includePast?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetCommunityEventsQuery = { __typename?: 'Query', communityEvents: { __typename?: 'CommunityEventConnection', totalCount: number, edges: Array<{ __typename?: 'CommunityEventEdge', cursor: string, node: { __typename?: 'CommunityEvent', id: string, title: string, description?: string | null, location?: string | null, startsAt: string, endsAt?: string | null, maxAttendees?: number | null, attendeeCount: number, isFull: boolean, myRsvp?: { __typename?: 'EventAttendee', id: string, status: string } | null, organizer: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GetCommunityEventQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetCommunityEventQuery = { __typename?: 'Query', communityEvent?: { __typename?: 'CommunityEvent', id: string, communityId: string, title: string, description?: string | null, location?: string | null, startsAt: string, endsAt?: string | null, maxAttendees?: number | null, attendeeCount: number, isFull: boolean, myRsvp?: { __typename?: 'EventAttendee', id: string, status: string } | null, organizer: { __typename?: 'User', id: string, username: string, profile?: { __typename?: 'Profile', displayName?: string | null, avatarUrl?: string | null } | null } } | null };

export type CreateCommunityEventMutationVariables = Exact<{
  communityId: Scalars['ID']['input'];
  input: CreateCommunityEventInput;
}>;


export type CreateCommunityEventMutation = { __typename?: 'Mutation', createCommunityEvent: { __typename?: 'CommunityEvent', id: string, title: string, startsAt: string, endsAt?: string | null } };

export type UpdateCommunityEventMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateCommunityEventInput;
}>;


export type UpdateCommunityEventMutation = { __typename?: 'Mutation', updateCommunityEvent: { __typename?: 'CommunityEvent', id: string, title: string, description?: string | null, location?: string | null, startsAt: string, endsAt?: string | null, maxAttendees?: number | null } };

export type DeleteCommunityEventMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteCommunityEventMutation = { __typename?: 'Mutation', deleteCommunityEvent: boolean };

export type RsvpEventMutationVariables = Exact<{
  eventId: Scalars['ID']['input'];
  status: Scalars['String']['input'];
}>;


export type RsvpEventMutation = { __typename?: 'Mutation', rsvpEvent: { __typename?: 'EventAttendee', id: string, status: string, joinedAt: string } };

export type CancelRsvpMutationVariables = Exact<{
  eventId: Scalars['ID']['input'];
}>;


export type CancelRsvpMutation = { __typename?: 'Mutation', cancelRsvp: boolean };

export type GetNotificationsQueryVariables = Exact<{
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  unreadOnly?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type GetNotificationsQuery = { __typename?: 'Query', notifications: { __typename?: 'NotificationConnection', edges: Array<{ __typename?: 'NotificationEdge', cursor: string, node: { __typename?: 'Notification', id: string, type: string, title: string, body?: string | null, data?: any | null, isRead: boolean, createdAt: string } }>, pageInfo: { __typename?: 'PageInfo', hasNextPage: boolean, endCursor?: string | null } } };

export type GetUnreadCountQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUnreadCountQuery = { __typename?: 'Query', unreadNotificationCount: number };

export type MarkNotificationReadMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkNotificationReadMutation = { __typename?: 'Mutation', markNotificationRead: { __typename?: 'Notification', id: string, isRead: boolean } };

export type MarkAllNotificationsReadMutationVariables = Exact<{ [key: string]: never; }>;


export type MarkAllNotificationsReadMutation = { __typename?: 'Mutation', markAllNotificationsRead: boolean };

export type DeleteNotificationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteNotificationMutation = { __typename?: 'Mutation', deleteNotification: boolean };

export type SiteSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type SiteSettingsQuery = { __typename?: 'Query', siteSettings?: { __typename?: 'SiteSettings', id: string, bannerUrl?: string | null, tagline?: string | null, updatedAt: string } | null };

export type UpdateSiteSettingsMutationVariables = Exact<{
  input: UpdateSiteSettingsInput;
}>;


export type UpdateSiteSettingsMutation = { __typename?: 'Mutation', updateSiteSettings: { __typename?: 'SiteSettings', id: string, bannerUrl?: string | null, tagline?: string | null, updatedAt: string } };

export const PhotoFieldsFragmentDoc = gql`
    fragment PhotoFields on Photo {
  id
  caption
  aircraftType
  airline
  airportCode
  takenAt
  originalUrl
  originalWidth
  originalHeight
  fileSizeBytes
  mimeType
  moderationStatus
  tags
  likeCount
  commentCount
  isLikedByMe
  createdAt
  aircraft {
    id
    registration
    aircraftType
    airline
    msn
    manufacturingDate
  }
  photographer {
    id
    username
    profile {
      displayName
      avatarUrl
    }
  }
  photographerName
  gearBody
  gearLens
  user {
    id
    username
    isFollowedByMe
    profile {
      displayName
      avatarUrl
    }
  }
  variants {
    id
    variantType
    url
    width
    height
  }
  location {
    id
    latitude
    longitude
    privacyMode
    airport {
      id
      icaoCode
      iataCode
      name
    }
    spottingLocation {
      id
      name
    }
  }
}
    `;
export const AlbumFieldsFragmentDoc = gql`
    fragment AlbumFields on Album {
  id
  title
  description
  isPublic
  photoCount
  createdAt
  updatedAt
  communityId
  community {
    id
    name
    slug
  }
  user {
    id
    username
    profile {
      displayName
      avatarUrl
    }
  }
  coverPhoto {
    id
    variants {
      variantType
      url
      width
      height
    }
  }
}
    `;
export const SignUpDocument = gql`
    mutation SignUp($input: SignUpInput!) {
  signUp(input: $input) {
    token
    user {
      id
      email
      username
      role
    }
  }
}
    `;

export function useSignUpMutation() {
  return Urql.useMutation<SignUpMutation, SignUpMutationVariables>(SignUpDocument);
};
export const SignInDocument = gql`
    mutation SignIn($input: SignInInput!) {
  signIn(input: $input) {
    token
    user {
      id
      email
      username
      role
    }
  }
}
    `;

export function useSignInMutation() {
  return Urql.useMutation<SignInMutation, SignInMutationVariables>(SignInDocument);
};
export const RequestPasswordResetDocument = gql`
    mutation RequestPasswordReset($email: String!) {
  requestPasswordReset(email: $email)
}
    `;

export function useRequestPasswordResetMutation() {
  return Urql.useMutation<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>(RequestPasswordResetDocument);
};
export const ResetPasswordDocument = gql`
    mutation ResetPassword($token: String!, $newPassword: String!) {
  resetPassword(token: $token, newPassword: $newPassword) {
    token
    user {
      id
      email
      username
      role
    }
  }
}
    `;

export function useResetPasswordMutation() {
  return Urql.useMutation<ResetPasswordMutation, ResetPasswordMutationVariables>(ResetPasswordDocument);
};
export const PhotosDocument = gql`
    query Photos($first: Int, $after: String, $userId: ID, $albumId: ID, $aircraftType: String, $airportCode: String, $tags: [String!], $manufacturer: String, $airline: String, $photographer: String, $sortBy: PhotoSortBy) {
  photos(
    first: $first
    after: $after
    userId: $userId
    albumId: $albumId
    aircraftType: $aircraftType
    airportCode: $airportCode
    tags: $tags
    manufacturer: $manufacturer
    airline: $airline
    photographer: $photographer
    sortBy: $sortBy
  ) {
    edges {
      cursor
      node {
        ...PhotoFields
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function usePhotosQuery(options?: Omit<Urql.UseQueryArgs<PhotosQueryVariables>, 'query'>) {
  return Urql.useQuery<PhotosQuery, PhotosQueryVariables>({ query: PhotosDocument, ...options });
};
export const PhotoDocument = gql`
    query Photo($id: ID!) {
  photo(id: $id) {
    ...PhotoFields
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function usePhotoQuery(options: Omit<Urql.UseQueryArgs<PhotoQueryVariables>, 'query'>) {
  return Urql.useQuery<PhotoQuery, PhotoQueryVariables>({ query: PhotoDocument, ...options });
};
export const GetUploadUrlDocument = gql`
    mutation GetUploadUrl($input: GetUploadUrlInput!) {
  getUploadUrl(input: $input) {
    url
    key
  }
}
    `;

export function useGetUploadUrlMutation() {
  return Urql.useMutation<GetUploadUrlMutation, GetUploadUrlMutationVariables>(GetUploadUrlDocument);
};
export const CreatePhotoDocument = gql`
    mutation CreatePhoto($input: CreatePhotoInput!) {
  createPhoto(input: $input) {
    ...PhotoFields
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function useCreatePhotoMutation() {
  return Urql.useMutation<CreatePhotoMutation, CreatePhotoMutationVariables>(CreatePhotoDocument);
};
export const LikePhotoDocument = gql`
    mutation LikePhoto($photoId: ID!) {
  likePhoto(photoId: $photoId) {
    ...PhotoFields
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function useLikePhotoMutation() {
  return Urql.useMutation<LikePhotoMutation, LikePhotoMutationVariables>(LikePhotoDocument);
};
export const UnlikePhotoDocument = gql`
    mutation UnlikePhoto($photoId: ID!) {
  unlikePhoto(photoId: $photoId) {
    ...PhotoFields
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function useUnlikePhotoMutation() {
  return Urql.useMutation<UnlikePhotoMutation, UnlikePhotoMutationVariables>(UnlikePhotoDocument);
};
export const UserDocument = gql`
    query User($username: String!) {
  user(username: $username) {
    id
    username
    role
    photoCount
    followerCount
    followingCount
    isFollowedByMe
    profile {
      displayName
      bio
      avatarUrl
      locationRegion
      experienceLevel
      gear
      interests
      favoriteAircraft
      favoriteAirports
      isPublic
      cameraBodies
      lenses
    }
  }
}
    `;

export function useUserQuery(options: Omit<Urql.UseQueryArgs<UserQueryVariables>, 'query'>) {
  return Urql.useQuery<UserQuery, UserQueryVariables>({ query: UserDocument, ...options });
};
export const FollowUserDocument = gql`
    mutation FollowUser($userId: ID!) {
  followUser(userId: $userId) {
    id
    followerCount
    isFollowedByMe
  }
}
    `;

export function useFollowUserMutation() {
  return Urql.useMutation<FollowUserMutation, FollowUserMutationVariables>(FollowUserDocument);
};
export const UnfollowUserDocument = gql`
    mutation UnfollowUser($userId: ID!) {
  unfollowUser(userId: $userId) {
    id
    followerCount
    isFollowedByMe
  }
}
    `;

export function useUnfollowUserMutation() {
  return Urql.useMutation<UnfollowUserMutation, UnfollowUserMutationVariables>(UnfollowUserDocument);
};
export const CommentsDocument = gql`
    query Comments($photoId: ID!, $first: Int, $after: String) {
  comments(photoId: $photoId, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        body
        createdAt
        user {
          id
          username
          profile {
            displayName
            avatarUrl
          }
        }
        replies {
          id
          body
          createdAt
          user {
            id
            username
            profile {
              displayName
              avatarUrl
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useCommentsQuery(options: Omit<Urql.UseQueryArgs<CommentsQueryVariables>, 'query'>) {
  return Urql.useQuery<CommentsQuery, CommentsQueryVariables>({ query: CommentsDocument, ...options });
};
export const AddCommentDocument = gql`
    mutation AddComment($input: AddCommentInput!) {
  addComment(input: $input) {
    id
    body
    createdAt
    user {
      id
      username
      profile {
        displayName
        avatarUrl
      }
    }
    replies {
      id
      body
      createdAt
      user {
        id
        username
        profile {
          displayName
          avatarUrl
        }
      }
    }
  }
}
    `;

export function useAddCommentMutation() {
  return Urql.useMutation<AddCommentMutation, AddCommentMutationVariables>(AddCommentDocument);
};
export const DeleteCommentDocument = gql`
    mutation DeleteComment($id: ID!) {
  deleteComment(id: $id)
}
    `;

export function useDeleteCommentMutation() {
  return Urql.useMutation<DeleteCommentMutation, DeleteCommentMutationVariables>(DeleteCommentDocument);
};
export const CreateReportDocument = gql`
    mutation CreateReport($input: CreateReportInput!) {
  createReport(input: $input) {
    id
    status
  }
}
    `;

export function useCreateReportMutation() {
  return Urql.useMutation<CreateReportMutation, CreateReportMutationVariables>(CreateReportDocument);
};
export const MeDocument = gql`
    query Me {
  me {
    id
    email
    username
    role
    photoCount
    profile {
      displayName
      bio
      avatarUrl
      locationRegion
      experienceLevel
      gear
      interests
      favoriteAircraft
      favoriteAirports
      isPublic
      cameraBodies
      lenses
    }
  }
}
    `;

export function useMeQuery(options?: Omit<Urql.UseQueryArgs<MeQueryVariables>, 'query'>) {
  return Urql.useQuery<MeQuery, MeQueryVariables>({ query: MeDocument, ...options });
};
export const UpdateProfileDocument = gql`
    mutation UpdateProfile($input: UpdateProfileInput!) {
  updateProfile(input: $input) {
    displayName
    bio
    avatarUrl
    locationRegion
    experienceLevel
    gear
    interests
    favoriteAircraft
    favoriteAirports
    isPublic
    cameraBodies
    lenses
  }
}
    `;

export function useUpdateProfileMutation() {
  return Urql.useMutation<UpdateProfileMutation, UpdateProfileMutationVariables>(UpdateProfileDocument);
};
export const UpdateAvatarDocument = gql`
    mutation UpdateAvatar($avatarUrl: String!) {
  updateAvatar(avatarUrl: $avatarUrl) {
    avatarUrl
  }
}
    `;

export function useUpdateAvatarMutation() {
  return Urql.useMutation<UpdateAvatarMutation, UpdateAvatarMutationVariables>(UpdateAvatarDocument);
};
export const SearchPhotosDocument = gql`
    query SearchPhotos($query: String!, $first: Int, $after: String) {
  searchPhotos(query: $query, first: $first, after: $after) {
    edges {
      cursor
      node {
        ...PhotoFields
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function useSearchPhotosQuery(options: Omit<Urql.UseQueryArgs<SearchPhotosQueryVariables>, 'query'>) {
  return Urql.useQuery<SearchPhotosQuery, SearchPhotosQueryVariables>({ query: SearchPhotosDocument, ...options });
};
export const SearchUsersDocument = gql`
    query SearchUsers($query: String!, $first: Int, $after: String) {
  searchUsers(query: $query, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        username
        photoCount
        followerCount
        profile {
          displayName
          avatarUrl
          bio
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useSearchUsersQuery(options: Omit<Urql.UseQueryArgs<SearchUsersQueryVariables>, 'query'>) {
  return Urql.useQuery<SearchUsersQuery, SearchUsersQueryVariables>({ query: SearchUsersDocument, ...options });
};
export const SearchAirlinesDocument = gql`
    query SearchAirlines($query: String!, $first: Int) {
  searchAirlines(query: $query, first: $first)
}
    `;

export function useSearchAirlinesQuery(options: Omit<Urql.UseQueryArgs<SearchAirlinesQueryVariables>, 'query'>) {
  return Urql.useQuery<SearchAirlinesQuery, SearchAirlinesQueryVariables>({ query: SearchAirlinesDocument, ...options });
};
export const SearchAirportsDocument = gql`
    query SearchAirports($query: String!, $first: Int) {
  searchAirports(query: $query, first: $first) {
    icaoCode
    iataCode
    name
    city
    country
  }
}
    `;

export function useSearchAirportsQuery(options: Omit<Urql.UseQueryArgs<SearchAirportsQueryVariables>, 'query'>) {
  return Urql.useQuery<SearchAirportsQuery, SearchAirportsQueryVariables>({ query: SearchAirportsDocument, ...options });
};
export const SearchAircraftTypesDocument = gql`
    query SearchAircraftTypes($search: String!, $first: Int) {
  aircraftTypes(search: $search, first: $first) {
    edges {
      cursor
      node {
        id
        iataCode
        icaoCode
        vendor
        model
        category
        engineType
        engineCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
    `;

export function useSearchAircraftTypesQuery(options: Omit<Urql.UseQueryArgs<SearchAircraftTypesQueryVariables>, 'query'>) {
  return Urql.useQuery<SearchAircraftTypesQuery, SearchAircraftTypesQueryVariables>({ query: SearchAircraftTypesDocument, ...options });
};
export const AirportsDocument = gql`
    query Airports {
  airports {
    id
    icaoCode
    iataCode
    name
    city
    country
    latitude
    longitude
    photoCount
  }
}
    `;

export function useAirportsQuery(options?: Omit<Urql.UseQueryArgs<AirportsQueryVariables>, 'query'>) {
  return Urql.useQuery<AirportsQuery, AirportsQueryVariables>({ query: AirportsDocument, ...options });
};
export const AirportDocument = gql`
    query Airport($code: String!) {
  airport(code: $code) {
    id
    icaoCode
    iataCode
    name
    city
    country
    latitude
    longitude
    photoCount
    isFollowedByMe
    followerCount
    spottingLocations {
      id
      name
      description
      accessNotes
      latitude
      longitude
    }
  }
}
    `;

export function useAirportQuery(options: Omit<Urql.UseQueryArgs<AirportQueryVariables>, 'query'>) {
  return Urql.useQuery<AirportQuery, AirportQueryVariables>({ query: AirportDocument, ...options });
};
export const PhotosInBoundsDocument = gql`
    query PhotosInBounds($swLat: Float!, $swLng: Float!, $neLat: Float!, $neLng: Float!, $first: Int) {
  photosInBounds(
    swLat: $swLat
    swLng: $swLng
    neLat: $neLat
    neLng: $neLng
    first: $first
  ) {
    id
    latitude
    longitude
    thumbnailUrl
    caption
  }
}
    `;

export function usePhotosInBoundsQuery(options: Omit<Urql.UseQueryArgs<PhotosInBoundsQueryVariables>, 'query'>) {
  return Urql.useQuery<PhotosInBoundsQuery, PhotosInBoundsQueryVariables>({ query: PhotosInBoundsDocument, ...options });
};
export const PhotosNearbyDocument = gql`
    query PhotosNearby($latitude: Float!, $longitude: Float!, $radiusMeters: Float, $first: Int) {
  photosNearby(
    latitude: $latitude
    longitude: $longitude
    radiusMeters: $radiusMeters
    first: $first
  ) {
    id
    latitude
    longitude
    thumbnailUrl
    caption
  }
}
    `;

export function usePhotosNearbyQuery(options: Omit<Urql.UseQueryArgs<PhotosNearbyQueryVariables>, 'query'>) {
  return Urql.useQuery<PhotosNearbyQuery, PhotosNearbyQueryVariables>({ query: PhotosNearbyDocument, ...options });
};
export const CreateSpottingLocationDocument = gql`
    mutation CreateSpottingLocation($input: CreateSpottingLocationInput!) {
  createSpottingLocation(input: $input) {
    id
    name
    description
    accessNotes
    latitude
    longitude
    createdBy {
      id
      username
      profile {
        displayName
      }
    }
  }
}
    `;

export function useCreateSpottingLocationMutation() {
  return Urql.useMutation<CreateSpottingLocationMutation, CreateSpottingLocationMutationVariables>(CreateSpottingLocationDocument);
};
export const DeleteSpottingLocationDocument = gql`
    mutation DeleteSpottingLocation($id: ID!) {
  deleteSpottingLocation(id: $id)
}
    `;

export function useDeleteSpottingLocationMutation() {
  return Urql.useMutation<DeleteSpottingLocationMutation, DeleteSpottingLocationMutationVariables>(DeleteSpottingLocationDocument);
};
export const AlbumDocument = gql`
    query Album($id: ID!) {
  album(id: $id) {
    ...AlbumFields
    myMembership {
      id
      role
      status
    }
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useAlbumQuery(options: Omit<Urql.UseQueryArgs<AlbumQueryVariables>, 'query'>) {
  return Urql.useQuery<AlbumQuery, AlbumQueryVariables>({ query: AlbumDocument, ...options });
};
export const AlbumsDocument = gql`
    query Albums($userId: ID, $first: Int, $after: String) {
  albums(userId: $userId, first: $first, after: $after) {
    edges {
      cursor
      node {
        ...AlbumFields
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useAlbumsQuery(options?: Omit<Urql.UseQueryArgs<AlbumsQueryVariables>, 'query'>) {
  return Urql.useQuery<AlbumsQuery, AlbumsQueryVariables>({ query: AlbumsDocument, ...options });
};
export const CreateAlbumDocument = gql`
    mutation CreateAlbum($input: CreateAlbumInput!) {
  createAlbum(input: $input) {
    ...AlbumFields
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useCreateAlbumMutation() {
  return Urql.useMutation<CreateAlbumMutation, CreateAlbumMutationVariables>(CreateAlbumDocument);
};
export const UpdateAlbumDocument = gql`
    mutation UpdateAlbum($id: ID!, $input: UpdateAlbumInput!) {
  updateAlbum(id: $id, input: $input) {
    ...AlbumFields
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useUpdateAlbumMutation() {
  return Urql.useMutation<UpdateAlbumMutation, UpdateAlbumMutationVariables>(UpdateAlbumDocument);
};
export const DeleteAlbumDocument = gql`
    mutation DeleteAlbum($id: ID!) {
  deleteAlbum(id: $id)
}
    `;

export function useDeleteAlbumMutation() {
  return Urql.useMutation<DeleteAlbumMutation, DeleteAlbumMutationVariables>(DeleteAlbumDocument);
};
export const AddPhotosToAlbumDocument = gql`
    mutation AddPhotosToAlbum($albumId: ID!, $photoIds: [ID!]!) {
  addPhotosToAlbum(albumId: $albumId, photoIds: $photoIds) {
    ...AlbumFields
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useAddPhotosToAlbumMutation() {
  return Urql.useMutation<AddPhotosToAlbumMutation, AddPhotosToAlbumMutationVariables>(AddPhotosToAlbumDocument);
};
export const RemovePhotosFromAlbumDocument = gql`
    mutation RemovePhotosFromAlbum($albumId: ID!, $photoIds: [ID!]!) {
  removePhotosFromAlbum(albumId: $albumId, photoIds: $photoIds) {
    ...AlbumFields
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useRemovePhotosFromAlbumMutation() {
  return Urql.useMutation<RemovePhotosFromAlbumMutation, RemovePhotosFromAlbumMutationVariables>(RemovePhotosFromAlbumDocument);
};
export const CreateCommunityAlbumDocument = gql`
    mutation CreateCommunityAlbum($communityId: ID!, $input: CreateAlbumInput!) {
  createCommunityAlbum(communityId: $communityId, input: $input) {
    ...AlbumFields
    community {
      id
      name
      slug
    }
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useCreateCommunityAlbumMutation() {
  return Urql.useMutation<CreateCommunityAlbumMutation, CreateCommunityAlbumMutationVariables>(CreateCommunityAlbumDocument);
};
export const AddPhotosToCommunityAlbumDocument = gql`
    mutation AddPhotosToCommunityAlbum($albumId: ID!, $photoIds: [ID!]!) {
  addPhotosToCommunityAlbum(albumId: $albumId, photoIds: $photoIds) {
    ...AlbumFields
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useAddPhotosToCommunityAlbumMutation() {
  return Urql.useMutation<AddPhotosToCommunityAlbumMutation, AddPhotosToCommunityAlbumMutationVariables>(AddPhotosToCommunityAlbumDocument);
};
export const RemovePhotosFromCommunityAlbumDocument = gql`
    mutation RemovePhotosFromCommunityAlbum($albumId: ID!, $photoIds: [ID!]!) {
  removePhotosFromCommunityAlbum(albumId: $albumId, photoIds: $photoIds) {
    ...AlbumFields
  }
}
    ${AlbumFieldsFragmentDoc}`;

export function useRemovePhotosFromCommunityAlbumMutation() {
  return Urql.useMutation<RemovePhotosFromCommunityAlbumMutation, RemovePhotosFromCommunityAlbumMutationVariables>(RemovePhotosFromCommunityAlbumDocument);
};
export const FollowAirportDocument = gql`
    mutation FollowAirport($airportId: ID!) {
  followAirport(airportId: $airportId) {
    id
    isFollowedByMe
    followerCount
  }
}
    `;

export function useFollowAirportMutation() {
  return Urql.useMutation<FollowAirportMutation, FollowAirportMutationVariables>(FollowAirportDocument);
};
export const UnfollowAirportDocument = gql`
    mutation UnfollowAirport($airportId: ID!) {
  unfollowAirport(airportId: $airportId) {
    id
    isFollowedByMe
    followerCount
  }
}
    `;

export function useUnfollowAirportMutation() {
  return Urql.useMutation<UnfollowAirportMutation, UnfollowAirportMutationVariables>(UnfollowAirportDocument);
};
export const FollowTopicDocument = gql`
    mutation FollowTopic($targetType: String!, $value: String!) {
  followTopic(targetType: $targetType, value: $value) {
    targetType
    value
  }
}
    `;

export function useFollowTopicMutation() {
  return Urql.useMutation<FollowTopicMutation, FollowTopicMutationVariables>(FollowTopicDocument);
};
export const UnfollowTopicDocument = gql`
    mutation UnfollowTopic($targetType: String!, $value: String!) {
  unfollowTopic(targetType: $targetType, value: $value) {
    targetType
    value
  }
}
    `;

export function useUnfollowTopicMutation() {
  return Urql.useMutation<UnfollowTopicMutation, UnfollowTopicMutationVariables>(UnfollowTopicDocument);
};
export const MyFollowingDocument = gql`
    query MyFollowing($targetType: String) {
  myFollowing(targetType: $targetType) {
    id
    targetType
    user {
      id
      username
      isFollowedByMe
      profile {
        displayName
        avatarUrl
      }
    }
    airport {
      id
      icaoCode
      iataCode
      name
      city
      country
      isFollowedByMe
      followerCount
    }
    targetValue
    createdAt
  }
}
    `;

export function useMyFollowingQuery(options?: Omit<Urql.UseQueryArgs<MyFollowingQueryVariables>, 'query'>) {
  return Urql.useQuery<MyFollowingQuery, MyFollowingQueryVariables>({ query: MyFollowingDocument, ...options });
};
export const FollowingFeedDocument = gql`
    query FollowingFeed($first: Int, $after: String) {
  followingFeed(first: $first, after: $after) {
    edges {
      cursor
      node {
        ...PhotoFields
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function useFollowingFeedQuery(options?: Omit<Urql.UseQueryArgs<FollowingFeedQueryVariables>, 'query'>) {
  return Urql.useQuery<FollowingFeedQuery, FollowingFeedQueryVariables>({ query: FollowingFeedDocument, ...options });
};
export const AdminStatsDocument = gql`
    query AdminStats {
  adminStats {
    totalUsers
    totalPhotos
    pendingPhotos
    openReports
    totalAirports
    totalSpottingLocations
  }
}
    `;

export function useAdminStatsQuery(options?: Omit<Urql.UseQueryArgs<AdminStatsQueryVariables>, 'query'>) {
  return Urql.useQuery<AdminStatsQuery, AdminStatsQueryVariables>({ query: AdminStatsDocument, ...options });
};
export const AdminReportsDocument = gql`
    query AdminReports($status: String, $first: Int, $after: String) {
  adminReports(status: $status, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        targetType
        targetId
        reason
        description
        status
        reporter {
          id
          username
        }
        reviewer {
          id
          username
        }
        createdAt
        resolvedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useAdminReportsQuery(options?: Omit<Urql.UseQueryArgs<AdminReportsQueryVariables>, 'query'>) {
  return Urql.useQuery<AdminReportsQuery, AdminReportsQueryVariables>({ query: AdminReportsDocument, ...options });
};
export const AdminUsersDocument = gql`
    query AdminUsers($role: String, $status: String, $search: String, $first: Int, $after: String) {
  adminUsers(
    role: $role
    status: $status
    search: $search
    first: $first
    after: $after
  ) {
    edges {
      cursor
      node {
        id
        username
        email
        role
        status
        createdAt
        profile {
          displayName
          avatarUrl
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useAdminUsersQuery(options?: Omit<Urql.UseQueryArgs<AdminUsersQueryVariables>, 'query'>) {
  return Urql.useQuery<AdminUsersQuery, AdminUsersQueryVariables>({ query: AdminUsersDocument, ...options });
};
export const AdminPhotosDocument = gql`
    query AdminPhotos($moderationStatus: String, $first: Int, $after: String) {
  adminPhotos(moderationStatus: $moderationStatus, first: $first, after: $after) {
    edges {
      cursor
      node {
        ...PhotoFields
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    ${PhotoFieldsFragmentDoc}`;

export function useAdminPhotosQuery(options?: Omit<Urql.UseQueryArgs<AdminPhotosQueryVariables>, 'query'>) {
  return Urql.useQuery<AdminPhotosQuery, AdminPhotosQueryVariables>({ query: AdminPhotosDocument, ...options });
};
export const AdminAircraftTypesDocument = gql`
    query AdminAircraftTypes($search: String, $first: Int, $after: String) {
  adminAircraftTypes(search: $search, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        iataCode
        icaoCode
        vendor
        model
        category
        engineType
        engineCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useAdminAircraftTypesQuery(options?: Omit<Urql.UseQueryArgs<AdminAircraftTypesQueryVariables>, 'query'>) {
  return Urql.useQuery<AdminAircraftTypesQuery, AdminAircraftTypesQueryVariables>({ query: AdminAircraftTypesDocument, ...options });
};
export const DeleteAircraftTypeDocument = gql`
    mutation DeleteAircraftType($id: ID!) {
  deleteAircraftType(id: $id)
}
    `;

export function useDeleteAircraftTypeMutation() {
  return Urql.useMutation<DeleteAircraftTypeMutation, DeleteAircraftTypeMutationVariables>(DeleteAircraftTypeDocument);
};
export const CreateAircraftTypeDocument = gql`
    mutation CreateAircraftType($input: CreateAircraftTypeInput!) {
  createAircraftType(input: $input) {
    id
  }
}
    `;

export function useCreateAircraftTypeMutation() {
  return Urql.useMutation<CreateAircraftTypeMutation, CreateAircraftTypeMutationVariables>(CreateAircraftTypeDocument);
};
export const UpdateAircraftTypeDocument = gql`
    mutation UpdateAircraftType($id: ID!, $input: UpdateAircraftTypeInput!) {
  updateAircraftType(id: $id, input: $input) {
    id
  }
}
    `;

export function useUpdateAircraftTypeMutation() {
  return Urql.useMutation<UpdateAircraftTypeMutation, UpdateAircraftTypeMutationVariables>(UpdateAircraftTypeDocument);
};
export const UpsertAircraftTypeDocument = gql`
    mutation UpsertAircraftType($input: CreateAircraftTypeInput!) {
  upsertAircraftType(input: $input) {
    id
  }
}
    `;

export function useUpsertAircraftTypeMutation() {
  return Urql.useMutation<UpsertAircraftTypeMutation, UpsertAircraftTypeMutationVariables>(UpsertAircraftTypeDocument);
};
export const AdminAirportsDocument = gql`
    query AdminAirports($search: String, $first: Int, $after: String) {
  adminAirports(search: $search, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        icaoCode
        iataCode
        name
        city
        country
        latitude
        longitude
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useAdminAirportsQuery(options?: Omit<Urql.UseQueryArgs<AdminAirportsQueryVariables>, 'query'>) {
  return Urql.useQuery<AdminAirportsQuery, AdminAirportsQueryVariables>({ query: AdminAirportsDocument, ...options });
};
export const ExportAircraftTypesDocument = gql`
    query ExportAircraftTypes {
  exportAircraftTypes {
    id
    iataCode
    icaoCode
    vendor
    model
    category
    engineType
    engineCount
  }
}
    `;

export function useExportAircraftTypesQuery(options?: Omit<Urql.UseQueryArgs<ExportAircraftTypesQueryVariables>, 'query'>) {
  return Urql.useQuery<ExportAircraftTypesQuery, ExportAircraftTypesQueryVariables>({ query: ExportAircraftTypesDocument, ...options });
};
export const ExportAirportsDocument = gql`
    query ExportAirports {
  exportAirports {
    id
    icaoCode
    iataCode
    name
    city
    country
    latitude
    longitude
  }
}
    `;

export function useExportAirportsQuery(options?: Omit<Urql.UseQueryArgs<ExportAirportsQueryVariables>, 'query'>) {
  return Urql.useQuery<ExportAirportsQuery, ExportAirportsQueryVariables>({ query: ExportAirportsDocument, ...options });
};
export const CreateAirportDocument = gql`
    mutation CreateAirport($input: CreateAirportInput!) {
  createAirport(input: $input) {
    id
    icaoCode
    iataCode
    name
    city
    country
    latitude
    longitude
  }
}
    `;

export function useCreateAirportMutation() {
  return Urql.useMutation<CreateAirportMutation, CreateAirportMutationVariables>(CreateAirportDocument);
};
export const UpdateAirportDocument = gql`
    mutation UpdateAirport($id: ID!, $input: UpdateAirportInput!) {
  updateAirport(id: $id, input: $input) {
    id
    icaoCode
    iataCode
    name
    city
    country
    latitude
    longitude
  }
}
    `;

export function useUpdateAirportMutation() {
  return Urql.useMutation<UpdateAirportMutation, UpdateAirportMutationVariables>(UpdateAirportDocument);
};
export const UpsertAirportDocument = gql`
    mutation UpsertAirport($input: CreateAirportInput!) {
  upsertAirport(input: $input) {
    id
  }
}
    `;

export function useUpsertAirportMutation() {
  return Urql.useMutation<UpsertAirportMutation, UpsertAirportMutationVariables>(UpsertAirportDocument);
};
export const DeleteAirportDocument = gql`
    mutation DeleteAirport($id: ID!) {
  deleteAirport(id: $id)
}
    `;

export function useDeleteAirportMutation() {
  return Urql.useMutation<DeleteAirportMutation, DeleteAirportMutationVariables>(DeleteAirportDocument);
};
export const AdminResolveReportDocument = gql`
    mutation AdminResolveReport($id: ID!, $action: String!) {
  adminResolveReport(id: $id, action: $action) {
    id
    status
    resolvedAt
  }
}
    `;

export function useAdminResolveReportMutation() {
  return Urql.useMutation<AdminResolveReportMutation, AdminResolveReportMutationVariables>(AdminResolveReportDocument);
};
export const AdminUpdateUserStatusDocument = gql`
    mutation AdminUpdateUserStatus($userId: ID!, $status: String!) {
  adminUpdateUserStatus(userId: $userId, status: $status) {
    id
    status
  }
}
    `;

export function useAdminUpdateUserStatusMutation() {
  return Urql.useMutation<AdminUpdateUserStatusMutation, AdminUpdateUserStatusMutationVariables>(AdminUpdateUserStatusDocument);
};
export const AdminUpdateUserRoleDocument = gql`
    mutation AdminUpdateUserRole($userId: ID!, $role: String!) {
  adminUpdateUserRole(userId: $userId, role: $role) {
    id
    role
  }
}
    `;

export function useAdminUpdateUserRoleMutation() {
  return Urql.useMutation<AdminUpdateUserRoleMutation, AdminUpdateUserRoleMutationVariables>(AdminUpdateUserRoleDocument);
};
export const AdminUpdatePhotoModerationDocument = gql`
    mutation AdminUpdatePhotoModeration($photoId: ID!, $status: String!) {
  adminUpdatePhotoModeration(photoId: $photoId, status: $status) {
    id
    moderationStatus
  }
}
    `;

export function useAdminUpdatePhotoModerationMutation() {
  return Urql.useMutation<AdminUpdatePhotoModerationMutation, AdminUpdatePhotoModerationMutationVariables>(AdminUpdatePhotoModerationDocument);
};
export const CommunityDocument = gql`
    query Community($slug: String!) {
  community(slug: $slug) {
    id
    name
    slug
    description
    bannerUrl
    avatarUrl
    category
    visibility
    location
    inviteCode
    createdAt
    owner {
      id
      username
      profile {
        displayName
        avatarUrl
      }
    }
    memberCount
    myMembership {
      id
      role
      status
    }
    members(first: 20) {
      edges {
        node {
          id
          role
          status
          joinedAt
          user {
            id
            username
            profile {
              displayName
              avatarUrl
            }
          }
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
    }
    photos(first: 12) {
      edges {
        cursor
        node {
          ...PhotoFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
    albums(first: 20) {
      edges {
        node {
          ...AlbumFields
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
    ${PhotoFieldsFragmentDoc}
${AlbumFieldsFragmentDoc}`;

export function useCommunityQuery(options: Omit<Urql.UseQueryArgs<CommunityQueryVariables>, 'query'>) {
  return Urql.useQuery<CommunityQuery, CommunityQueryVariables>({ query: CommunityDocument, ...options });
};
export const CommunitiesDocument = gql`
    query Communities($search: String, $category: String, $first: Int, $after: String) {
  communities(search: $search, category: $category, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        name
        slug
        description
        category
        avatarUrl
        location
        memberCount
        owner {
          username
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useCommunitiesQuery(options?: Omit<Urql.UseQueryArgs<CommunitiesQueryVariables>, 'query'>) {
  return Urql.useQuery<CommunitiesQuery, CommunitiesQueryVariables>({ query: CommunitiesDocument, ...options });
};
export const MyCommunitiesDocument = gql`
    query MyCommunities {
  myCommunities {
    id
    name
    slug
    avatarUrl
    memberCount
  }
}
    `;

export function useMyCommunitiesQuery(options?: Omit<Urql.UseQueryArgs<MyCommunitiesQueryVariables>, 'query'>) {
  return Urql.useQuery<MyCommunitiesQuery, MyCommunitiesQueryVariables>({ query: MyCommunitiesDocument, ...options });
};
export const CreateCommunityDocument = gql`
    mutation CreateCommunity($input: CreateCommunityInput!) {
  createCommunity(input: $input) {
    id
    slug
  }
}
    `;

export function useCreateCommunityMutation() {
  return Urql.useMutation<CreateCommunityMutation, CreateCommunityMutationVariables>(CreateCommunityDocument);
};
export const JoinCommunityDocument = gql`
    mutation JoinCommunity($communityId: ID!, $inviteCode: String) {
  joinCommunity(communityId: $communityId, inviteCode: $inviteCode) {
    id
    role
  }
}
    `;

export function useJoinCommunityMutation() {
  return Urql.useMutation<JoinCommunityMutation, JoinCommunityMutationVariables>(JoinCommunityDocument);
};
export const LeaveCommunityDocument = gql`
    mutation LeaveCommunity($communityId: ID!) {
  leaveCommunity(communityId: $communityId)
}
    `;

export function useLeaveCommunityMutation() {
  return Urql.useMutation<LeaveCommunityMutation, LeaveCommunityMutationVariables>(LeaveCommunityDocument);
};
export const UpdateCommunityDocument = gql`
    mutation UpdateCommunity($id: ID!, $input: UpdateCommunityInput!) {
  updateCommunity(id: $id, input: $input) {
    id
    name
    slug
    description
    category
    visibility
    location
  }
}
    `;

export function useUpdateCommunityMutation() {
  return Urql.useMutation<UpdateCommunityMutation, UpdateCommunityMutationVariables>(UpdateCommunityDocument);
};
export const DeleteCommunityDocument = gql`
    mutation DeleteCommunity($id: ID!) {
  deleteCommunity(id: $id)
}
    `;

export function useDeleteCommunityMutation() {
  return Urql.useMutation<DeleteCommunityMutation, DeleteCommunityMutationVariables>(DeleteCommunityDocument);
};
export const GenerateInviteCodeDocument = gql`
    mutation GenerateInviteCode($communityId: ID!) {
  generateInviteCode(communityId: $communityId) {
    id
    inviteCode
  }
}
    `;

export function useGenerateInviteCodeMutation() {
  return Urql.useMutation<GenerateInviteCodeMutation, GenerateInviteCodeMutationVariables>(GenerateInviteCodeDocument);
};
export const BanCommunityMemberDocument = gql`
    mutation BanCommunityMember($communityId: ID!, $userId: ID!, $reason: String) {
  banCommunityMember(communityId: $communityId, userId: $userId, reason: $reason) {
    id
    status
    role
  }
}
    `;

export function useBanCommunityMemberMutation() {
  return Urql.useMutation<BanCommunityMemberMutation, BanCommunityMemberMutationVariables>(BanCommunityMemberDocument);
};
export const UnbanCommunityMemberDocument = gql`
    mutation UnbanCommunityMember($communityId: ID!, $userId: ID!) {
  unbanCommunityMember(communityId: $communityId, userId: $userId) {
    id
    status
    role
  }
}
    `;

export function useUnbanCommunityMemberMutation() {
  return Urql.useMutation<UnbanCommunityMemberMutation, UnbanCommunityMemberMutationVariables>(UnbanCommunityMemberDocument);
};
export const RemoveCommunityMemberDocument = gql`
    mutation RemoveCommunityMember($communityId: ID!, $userId: ID!) {
  removeCommunityMember(communityId: $communityId, userId: $userId)
}
    `;

export function useRemoveCommunityMemberMutation() {
  return Urql.useMutation<RemoveCommunityMemberMutation, RemoveCommunityMemberMutationVariables>(RemoveCommunityMemberDocument);
};
export const CommunityModerationLogsDocument = gql`
    query CommunityModerationLogs($communityId: ID!, $action: String, $first: Int, $after: String) {
  communityModerationLogs(
    communityId: $communityId
    action: $action
    first: $first
    after: $after
  ) {
    edges {
      cursor
      node {
        id
        action
        reason
        metadata
        createdAt
        moderator {
          id
          username
          profile {
            displayName
            avatarUrl
          }
        }
        targetUser {
          id
          username
          profile {
            displayName
            avatarUrl
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useCommunityModerationLogsQuery(options: Omit<Urql.UseQueryArgs<CommunityModerationLogsQueryVariables>, 'query'>) {
  return Urql.useQuery<CommunityModerationLogsQuery, CommunityModerationLogsQueryVariables>({ query: CommunityModerationLogsDocument, ...options });
};
export const ForumCategoriesDocument = gql`
    query ForumCategories($communityId: ID!) {
  forumCategories(communityId: $communityId) {
    id
    name
    description
    slug
    position
    threadCount
    latestThread {
      id
      title
      lastPostAt
      author {
        username
      }
    }
  }
}
    `;

export function useForumCategoriesQuery(options: Omit<Urql.UseQueryArgs<ForumCategoriesQueryVariables>, 'query'>) {
  return Urql.useQuery<ForumCategoriesQuery, ForumCategoriesQueryVariables>({ query: ForumCategoriesDocument, ...options });
};
export const ForumThreadsDocument = gql`
    query ForumThreads($categoryId: ID!, $first: Int, $after: String) {
  forumThreads(categoryId: $categoryId, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        title
        isPinned
        isLocked
        postCount
        lastPostAt
        createdAt
        author {
          username
          profile {
            displayName
            avatarUrl
          }
        }
        firstPost {
          body
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useForumThreadsQuery(options: Omit<Urql.UseQueryArgs<ForumThreadsQueryVariables>, 'query'>) {
  return Urql.useQuery<ForumThreadsQuery, ForumThreadsQueryVariables>({ query: ForumThreadsDocument, ...options });
};
export const ForumThreadDocument = gql`
    query ForumThread($id: ID!) {
  forumThread(id: $id) {
    id
    title
    isPinned
    isLocked
    postCount
    lastPostAt
    createdAt
    author {
      username
      profile {
        displayName
        avatarUrl
      }
    }
    category {
      id
      name
      slug
      communityId
    }
  }
}
    `;

export function useForumThreadQuery(options: Omit<Urql.UseQueryArgs<ForumThreadQueryVariables>, 'query'>) {
  return Urql.useQuery<ForumThreadQuery, ForumThreadQueryVariables>({ query: ForumThreadDocument, ...options });
};
export const ForumPostsDocument = gql`
    query ForumPosts($threadId: ID!, $first: Int, $after: String) {
  forumPosts(threadId: $threadId, first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        body
        isDeleted
        createdAt
        updatedAt
        author {
          username
          profile {
            displayName
            avatarUrl
          }
        }
        replies {
          id
          body
          isDeleted
          createdAt
          author {
            username
            profile {
              displayName
              avatarUrl
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useForumPostsQuery(options: Omit<Urql.UseQueryArgs<ForumPostsQueryVariables>, 'query'>) {
  return Urql.useQuery<ForumPostsQuery, ForumPostsQueryVariables>({ query: ForumPostsDocument, ...options });
};
export const CreateForumCategoryDocument = gql`
    mutation CreateForumCategory($communityId: ID, $name: String!, $description: String, $slug: String) {
  createForumCategory(
    communityId: $communityId
    name: $name
    description: $description
    slug: $slug
  ) {
    id
    name
    slug
    description
    position
    threadCount
  }
}
    `;

export function useCreateForumCategoryMutation() {
  return Urql.useMutation<CreateForumCategoryMutation, CreateForumCategoryMutationVariables>(CreateForumCategoryDocument);
};
export const UpdateForumCategoryDocument = gql`
    mutation UpdateForumCategory($id: ID!, $name: String, $description: String, $position: Int) {
  updateForumCategory(
    id: $id
    name: $name
    description: $description
    position: $position
  ) {
    id
    name
    description
    position
  }
}
    `;

export function useUpdateForumCategoryMutation() {
  return Urql.useMutation<UpdateForumCategoryMutation, UpdateForumCategoryMutationVariables>(UpdateForumCategoryDocument);
};
export const DeleteForumCategoryDocument = gql`
    mutation DeleteForumCategory($id: ID!) {
  deleteForumCategory(id: $id)
}
    `;

export function useDeleteForumCategoryMutation() {
  return Urql.useMutation<DeleteForumCategoryMutation, DeleteForumCategoryMutationVariables>(DeleteForumCategoryDocument);
};
export const CreateForumThreadDocument = gql`
    mutation CreateForumThread($categoryId: ID!, $title: String!, $body: String!) {
  createForumThread(categoryId: $categoryId, title: $title, body: $body) {
    id
    title
    isPinned
    isLocked
    postCount
    createdAt
    author {
      username
    }
  }
}
    `;

export function useCreateForumThreadMutation() {
  return Urql.useMutation<CreateForumThreadMutation, CreateForumThreadMutationVariables>(CreateForumThreadDocument);
};
export const DeleteForumThreadDocument = gql`
    mutation DeleteForumThread($id: ID!) {
  deleteForumThread(id: $id)
}
    `;

export function useDeleteForumThreadMutation() {
  return Urql.useMutation<DeleteForumThreadMutation, DeleteForumThreadMutationVariables>(DeleteForumThreadDocument);
};
export const PinForumThreadDocument = gql`
    mutation PinForumThread($id: ID!, $pinned: Boolean!) {
  pinForumThread(id: $id, pinned: $pinned) {
    id
    isPinned
  }
}
    `;

export function usePinForumThreadMutation() {
  return Urql.useMutation<PinForumThreadMutation, PinForumThreadMutationVariables>(PinForumThreadDocument);
};
export const LockForumThreadDocument = gql`
    mutation LockForumThread($id: ID!, $locked: Boolean!) {
  lockForumThread(id: $id, locked: $locked) {
    id
    isLocked
  }
}
    `;

export function useLockForumThreadMutation() {
  return Urql.useMutation<LockForumThreadMutation, LockForumThreadMutationVariables>(LockForumThreadDocument);
};
export const CreateForumPostDocument = gql`
    mutation CreateForumPost($threadId: ID!, $body: String!, $parentPostId: ID) {
  createForumPost(threadId: $threadId, body: $body, parentPostId: $parentPostId) {
    id
    body
    isDeleted
    createdAt
    author {
      username
      profile {
        displayName
        avatarUrl
      }
    }
    replies {
      id
      body
      isDeleted
      createdAt
      author {
        username
        profile {
          displayName
          avatarUrl
        }
      }
    }
  }
}
    `;

export function useCreateForumPostMutation() {
  return Urql.useMutation<CreateForumPostMutation, CreateForumPostMutationVariables>(CreateForumPostDocument);
};
export const UpdateForumPostDocument = gql`
    mutation UpdateForumPost($id: ID!, $body: String!) {
  updateForumPost(id: $id, body: $body) {
    id
    body
  }
}
    `;

export function useUpdateForumPostMutation() {
  return Urql.useMutation<UpdateForumPostMutation, UpdateForumPostMutationVariables>(UpdateForumPostDocument);
};
export const GlobalForumCategoriesDocument = gql`
    query GlobalForumCategories {
  globalForumCategories {
    id
    name
    description
    slug
    position
    threadCount
    latestThread {
      id
      title
      lastPostAt
      author {
        username
      }
    }
  }
}
    `;

export function useGlobalForumCategoriesQuery(options?: Omit<Urql.UseQueryArgs<GlobalForumCategoriesQueryVariables>, 'query'>) {
  return Urql.useQuery<GlobalForumCategoriesQuery, GlobalForumCategoriesQueryVariables>({ query: GlobalForumCategoriesDocument, ...options });
};
export const CreateGlobalForumCategoryDocument = gql`
    mutation CreateGlobalForumCategory($name: String!, $description: String, $slug: String) {
  createGlobalForumCategory(name: $name, description: $description, slug: $slug) {
    id
    name
    slug
    description
    position
    threadCount
  }
}
    `;

export function useCreateGlobalForumCategoryMutation() {
  return Urql.useMutation<CreateGlobalForumCategoryMutation, CreateGlobalForumCategoryMutationVariables>(CreateGlobalForumCategoryDocument);
};
export const DeleteForumPostDocument = gql`
    mutation DeleteForumPost($id: ID!) {
  deleteForumPost(id: $id)
}
    `;

export function useDeleteForumPostMutation() {
  return Urql.useMutation<DeleteForumPostMutation, DeleteForumPostMutationVariables>(DeleteForumPostDocument);
};
export const GetCommunityEventsDocument = gql`
    query GetCommunityEvents($communityId: ID!, $first: Int, $after: String, $includePast: Boolean) {
  communityEvents(
    communityId: $communityId
    first: $first
    after: $after
    includePast: $includePast
  ) {
    edges {
      cursor
      node {
        id
        title
        description
        location
        startsAt
        endsAt
        maxAttendees
        attendeeCount
        isFull
        myRsvp {
          id
          status
        }
        organizer {
          id
          username
          profile {
            displayName
            avatarUrl
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
    `;

export function useGetCommunityEventsQuery(options: Omit<Urql.UseQueryArgs<GetCommunityEventsQueryVariables>, 'query'>) {
  return Urql.useQuery<GetCommunityEventsQuery, GetCommunityEventsQueryVariables>({ query: GetCommunityEventsDocument, ...options });
};
export const GetCommunityEventDocument = gql`
    query GetCommunityEvent($id: ID!) {
  communityEvent(id: $id) {
    id
    communityId
    title
    description
    location
    startsAt
    endsAt
    maxAttendees
    attendeeCount
    isFull
    myRsvp {
      id
      status
    }
    organizer {
      id
      username
      profile {
        displayName
        avatarUrl
      }
    }
  }
}
    `;

export function useGetCommunityEventQuery(options: Omit<Urql.UseQueryArgs<GetCommunityEventQueryVariables>, 'query'>) {
  return Urql.useQuery<GetCommunityEventQuery, GetCommunityEventQueryVariables>({ query: GetCommunityEventDocument, ...options });
};
export const CreateCommunityEventDocument = gql`
    mutation CreateCommunityEvent($communityId: ID!, $input: CreateCommunityEventInput!) {
  createCommunityEvent(communityId: $communityId, input: $input) {
    id
    title
    startsAt
    endsAt
  }
}
    `;

export function useCreateCommunityEventMutation() {
  return Urql.useMutation<CreateCommunityEventMutation, CreateCommunityEventMutationVariables>(CreateCommunityEventDocument);
};
export const UpdateCommunityEventDocument = gql`
    mutation UpdateCommunityEvent($id: ID!, $input: UpdateCommunityEventInput!) {
  updateCommunityEvent(id: $id, input: $input) {
    id
    title
    description
    location
    startsAt
    endsAt
    maxAttendees
  }
}
    `;

export function useUpdateCommunityEventMutation() {
  return Urql.useMutation<UpdateCommunityEventMutation, UpdateCommunityEventMutationVariables>(UpdateCommunityEventDocument);
};
export const DeleteCommunityEventDocument = gql`
    mutation DeleteCommunityEvent($id: ID!) {
  deleteCommunityEvent(id: $id)
}
    `;

export function useDeleteCommunityEventMutation() {
  return Urql.useMutation<DeleteCommunityEventMutation, DeleteCommunityEventMutationVariables>(DeleteCommunityEventDocument);
};
export const RsvpEventDocument = gql`
    mutation RsvpEvent($eventId: ID!, $status: String!) {
  rsvpEvent(eventId: $eventId, status: $status) {
    id
    status
    joinedAt
  }
}
    `;

export function useRsvpEventMutation() {
  return Urql.useMutation<RsvpEventMutation, RsvpEventMutationVariables>(RsvpEventDocument);
};
export const CancelRsvpDocument = gql`
    mutation CancelRsvp($eventId: ID!) {
  cancelRsvp(eventId: $eventId)
}
    `;

export function useCancelRsvpMutation() {
  return Urql.useMutation<CancelRsvpMutation, CancelRsvpMutationVariables>(CancelRsvpDocument);
};
export const GetNotificationsDocument = gql`
    query GetNotifications($first: Int, $after: String, $unreadOnly: Boolean) {
  notifications(first: $first, after: $after, unreadOnly: $unreadOnly) {
    edges {
      cursor
      node {
        id
        type
        title
        body
        data
        isRead
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
    `;

export function useGetNotificationsQuery(options?: Omit<Urql.UseQueryArgs<GetNotificationsQueryVariables>, 'query'>) {
  return Urql.useQuery<GetNotificationsQuery, GetNotificationsQueryVariables>({ query: GetNotificationsDocument, ...options });
};
export const GetUnreadCountDocument = gql`
    query GetUnreadCount {
  unreadNotificationCount
}
    `;

export function useGetUnreadCountQuery(options?: Omit<Urql.UseQueryArgs<GetUnreadCountQueryVariables>, 'query'>) {
  return Urql.useQuery<GetUnreadCountQuery, GetUnreadCountQueryVariables>({ query: GetUnreadCountDocument, ...options });
};
export const MarkNotificationReadDocument = gql`
    mutation MarkNotificationRead($id: ID!) {
  markNotificationRead(id: $id) {
    id
    isRead
  }
}
    `;

export function useMarkNotificationReadMutation() {
  return Urql.useMutation<MarkNotificationReadMutation, MarkNotificationReadMutationVariables>(MarkNotificationReadDocument);
};
export const MarkAllNotificationsReadDocument = gql`
    mutation MarkAllNotificationsRead {
  markAllNotificationsRead
}
    `;

export function useMarkAllNotificationsReadMutation() {
  return Urql.useMutation<MarkAllNotificationsReadMutation, MarkAllNotificationsReadMutationVariables>(MarkAllNotificationsReadDocument);
};
export const DeleteNotificationDocument = gql`
    mutation DeleteNotification($id: ID!) {
  deleteNotification(id: $id)
}
    `;

export function useDeleteNotificationMutation() {
  return Urql.useMutation<DeleteNotificationMutation, DeleteNotificationMutationVariables>(DeleteNotificationDocument);
};
export const SiteSettingsDocument = gql`
    query SiteSettings {
  siteSettings {
    id
    bannerUrl
    tagline
    updatedAt
  }
}
    `;

export function useSiteSettingsQuery(options?: Omit<Urql.UseQueryArgs<SiteSettingsQueryVariables>, 'query'>) {
  return Urql.useQuery<SiteSettingsQuery, SiteSettingsQueryVariables>({ query: SiteSettingsDocument, ...options });
};
export const UpdateSiteSettingsDocument = gql`
    mutation UpdateSiteSettings($input: UpdateSiteSettingsInput!) {
  updateSiteSettings(input: $input) {
    id
    bannerUrl
    tagline
    updatedAt
  }
}
    `;

export function useUpdateSiteSettingsMutation() {
  return Urql.useMutation<UpdateSiteSettingsMutation, UpdateSiteSettingsMutationVariables>(UpdateSiteSettingsDocument);
};