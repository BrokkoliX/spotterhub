import gql from 'graphql-tag';

export const typeDefs = gql`
  type Query {
    """
    Health check — verifies the API is running and the database is reachable.
    """
    health: HealthCheck!

    """
    Fetch the currently authenticated user, including their profile.
    Returns null if not authenticated.
    """
    me: User

    """
    Fetch a user by their unique username.
    Returns null if the user does not exist or their profile is private.
    """
    user(username: String!): User

    """
    Paginated list of users. Supports cursor-based pagination.
    """
    users(first: Int = 20, after: String): UserConnection!

    """
    Fetch a single photo by ID. Returns null if not found.
    """
    photo(id: ID!): Photo

    """
    Paginated, filterable photo feed. Supports cursor-based pagination
    and filtering by user, album, aircraft type, airport, and tags.
    """
    photos(
      first: Int = 20
      after: String
      userId: ID
      albumId: ID
      aircraftType: String
      airportCode: String
      tags: [String!]
    ): PhotoConnection!

    """
    Search photos by free text. Matches against caption, aircraft type,
    airline, airport code, and tags. Results ordered by relevance.
    """
    searchPhotos(query: String!, first: Int = 20, after: String): PhotoConnection!

    """
    Search users by username or display name.
    """
    searchUsers(query: String!, first: Int = 20, after: String): UserConnection!

    """
    Fetch a single album by ID.
    """
    album(id: ID!): Album

    """
    List albums for a specific user. If no userId is provided, returns the
    authenticated user's albums.
    """
    albums(userId: ID, first: Int = 20, after: String): AlbumConnection!

    """
    List what the authenticated user is following. Optionally filter by target type.
    """
    myFollowing(targetType: String): [FollowEntry!]!

    """
    Paginated feed of photos from followed users, airports, aircraft types,
    and manufacturers. Requires authentication.
    """
    followingFeed(first: Int = 20, after: String): PhotoConnection!

    """
    List all airports. Used to populate map markers.
    """
    airports: [Airport!]!

    """
    Fetch a single airport by ICAO or IATA code.
    """
    airport(code: String!): Airport

    """
    Paginated comments for a photo. Returns top-level comments with nested replies.
    """
    comments(photoId: ID!, first: Int = 20, after: String): CommentConnection!
  }

  type Mutation {
    """
    Register a new user account (dev mode — creates user + issues JWT).
    In production, registration is handled by AWS Cognito.
    """
    signUp(input: SignUpInput!): AuthPayload!

    """
    Sign in with email and password (dev mode — validates credentials + issues JWT).
    In production, authentication is handled by AWS Cognito.
    """
    signIn(input: SignInInput!): AuthPayload!

    """
    Update the authenticated user's profile.
    Creates a profile if one does not exist yet.
    """
    updateProfile(input: UpdateProfileInput!): Profile!

    """
    Update the authenticated user's avatar URL.
    In a future session, this will accept a file upload via presigned S3 URL.
    """
    updateAvatar(avatarUrl: String!): Profile!

    """
    Request a presigned S3 URL for uploading a photo.
    The client uploads directly to S3, then calls createPhoto with the returned key.
    """
    getUploadUrl(input: GetUploadUrlInput!): UploadUrlPayload!

    """
    Create a photo record after the file has been uploaded to S3.
    Triggers server-side image processing (thumbnail + display variant generation).
    In dev, moderation is auto-approved; in production, it starts as pending.
    """
    createPhoto(input: CreatePhotoInput!): Photo!

    """
    Update metadata on an existing photo. Only the photo owner can update.
    """
    updatePhoto(id: ID!, input: UpdatePhotoInput!): Photo!

    """
    Delete a photo and all its variants. Only the photo owner can delete.
    """
    deletePhoto(id: ID!): Boolean!

    """
    Like a photo. Idempotent — liking an already-liked photo is a no-op.
    Returns the updated photo.
    """
    likePhoto(photoId: ID!): Photo!

    """
    Unlike a photo. Idempotent — unliking a photo you haven't liked is a no-op.
    Returns the updated photo.
    """
    unlikePhoto(photoId: ID!): Photo!

    """
    Follow a user. Idempotent — following an already-followed user is a no-op.
    Returns the target user.
    """
    followUser(userId: ID!): User!

    """
    Unfollow a user. Idempotent — unfollowing a user you don't follow is a no-op.
    Returns the target user.
    """
    unfollowUser(userId: ID!): User!

    """
    Follow an airport. Idempotent. Returns the airport.
    """
    followAirport(airportId: ID!): Airport!

    """
    Unfollow an airport. Idempotent. Returns the airport.
    """
    unfollowAirport(airportId: ID!): Airport!

    """
    Follow a topic (aircraft_type or manufacturer). Idempotent.
    Returns the followed topic.
    """
    followTopic(targetType: String!, value: String!): FollowedTopic!

    """
    Unfollow a topic. Idempotent. Returns the unfollowed topic.
    """
    unfollowTopic(targetType: String!, value: String!): FollowedTopic!

    """
    Add a comment to a photo. Supports threaded replies via parentCommentId.
    """
    addComment(input: AddCommentInput!): Comment!

    """
    Update a comment's body. Only the comment author can update.
    """
    updateComment(id: ID!, body: String!): Comment!

    """
    Delete a comment. Only the comment author can delete.
    Deleting a parent comment cascades to all replies.
    """
    deleteComment(id: ID!): Boolean!

    """
    Create a new album. Requires authentication.
    """
    createAlbum(input: CreateAlbumInput!): Album!

    """
    Update an album's title, description, visibility, or cover photo.
    Only the album owner can update.
    """
    updateAlbum(id: ID!, input: UpdateAlbumInput!): Album!

    """
    Delete an album. Photos in the album are NOT deleted — they are unlinked.
    Only the album owner can delete.
    """
    deleteAlbum(id: ID!): Boolean!

    """
    Add photos to an album. Only the album owner can add photos, and only
    their own photos can be added.
    """
    addPhotosToAlbum(albumId: ID!, photoIds: [ID!]!): Album!

    """
    Remove photos from an album. Only the album owner can remove photos.
    """
    removePhotosFromAlbum(albumId: ID!, photoIds: [ID!]!): Album!

    """
    Report content (photo, comment, profile, or album) for moderation review.
    Duplicate reports on the same target are prevented.
    """
    createReport(input: CreateReportInput!): Report!
  }

  # ─── Auth Types ──────────────────────────────────────────────────────────

  input SignUpInput {
    """Email address for the new account."""
    email: String!
    """Unique username (3-30 chars, alphanumeric + hyphens/underscores)."""
    username: String!
    """Password (min 8 characters)."""
    password: String!
  }

  input SignInInput {
    """Email address."""
    email: String!
    """Password."""
    password: String!
  }

  """
  Returned after successful authentication. Contains the JWT token
  and the authenticated user record.
  """
  type AuthPayload {
    """JWT access token for subsequent authenticated requests."""
    token: String!
    """The authenticated user."""
    user: User!
  }

  # ─── User & Profile Types ────────────────────────────────────────────────

  """A registered SpotterHub user."""
  type User {
    id: ID!
    """Unique email address."""
    email: String!
    """Unique username, used in profile URLs (/u/username)."""
    username: String!
    """Platform role: user, moderator, or admin."""
    role: String!
    """Account status: active, suspended, or banned."""
    status: String!
    """The user's profile, if one has been created."""
    profile: Profile
    """Number of users following this user."""
    followerCount: Int!
    """Number of users this user follows."""
    followingCount: Int!
    """Whether the currently authenticated user follows this user."""
    isFollowedByMe: Boolean!
    """Number of photos uploaded by this user."""
    photoCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  """A user's public profile with biographical and preference information."""
  type Profile {
    id: ID!
    """Display name shown on the profile page."""
    displayName: String
    """Free-form biography text."""
    bio: String
    """URL to the user's avatar image."""
    avatarUrl: String
    """Geographic region (e.g., 'Pacific Northwest, USA')."""
    locationRegion: String
    """Self-reported experience level for aviation spotting."""
    experienceLevel: String
    """Camera/lens gear description."""
    gear: String
    """List of spotting interests (e.g., military, commercial, GA)."""
    interests: [String!]!
    """Favorite aircraft types (e.g., A380, 747, F-16)."""
    favoriteAircraft: [String!]!
    """Favorite airport codes."""
    favoriteAirports: [String!]!
    """Whether this profile is publicly visible."""
    isPublic: Boolean!
  }

  input UpdateProfileInput {
    displayName: String
    bio: String
    locationRegion: String
    experienceLevel: String
    gear: String
    interests: [String!]
    favoriteAircraft: [String!]
    favoriteAirports: [String!]
    isPublic: Boolean
  }

  # ─── Photo Types ─────────────────────────────────────────────────────────

  """An uploaded aviation photo with metadata and processing variants."""
  type Photo {
    id: ID!
    """The user who uploaded this photo."""
    user: User!
    """The album this photo belongs to, if any."""
    albumId: ID
    """Photo caption or description."""
    caption: String
    """Aircraft type (e.g., 'Boeing 747-8F', 'Airbus A380')."""
    aircraftType: String
    """Airline name."""
    airline: String
    """Airport ICAO or IATA code where the photo was taken."""
    airportCode: String
    """Date/time the photo was taken (from EXIF or user input)."""
    takenAt: String
    """URL to the original uploaded image."""
    originalUrl: String!
    """Original image width in pixels."""
    originalWidth: Int
    """Original image height in pixels."""
    originalHeight: Int
    """Original file size in bytes."""
    fileSizeBytes: Int
    """MIME type of the original file."""
    mimeType: String
    """Content moderation status."""
    moderationStatus: String!
    """Generated image variants (thumbnail, display, etc.)."""
    variants: [PhotoVariant!]!
    """User-applied tags."""
    tags: [String!]!
    """Number of likes on this photo."""
    likeCount: Int!
    """Number of comments on this photo."""
    commentCount: Int!
    """Whether the currently authenticated user has liked this photo."""
    isLikedByMe: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  """A processed image variant (thumbnail, display, etc.)."""
  type PhotoVariant {
    id: ID!
    """The variant type: thumbnail, display, full_res, or watermarked."""
    variantType: String!
    """URL to access this variant."""
    url: String!
    """Variant width in pixels."""
    width: Int!
    """Variant height in pixels."""
    height: Int!
    """Variant file size in bytes."""
    fileSizeBytes: Int
  }

  input GetUploadUrlInput {
    """MIME type of the file to upload (image/jpeg, image/png, etc.)."""
    mimeType: String!
    """File size in bytes (for tier limit validation)."""
    fileSizeBytes: Int!
  }

  """Presigned URL payload for client-side S3 upload."""
  type UploadUrlPayload {
    """Presigned PUT URL — upload the file directly to this URL."""
    url: String!
    """S3 object key — pass this to createPhoto after upload completes."""
    key: String!
  }

  input CreatePhotoInput {
    """S3 object key returned from getUploadUrl."""
    s3Key: String!
    """MIME type of the uploaded file."""
    mimeType: String!
    """File size in bytes."""
    fileSizeBytes: Int!
    """Photo caption or description."""
    caption: String
    """Aircraft type."""
    aircraftType: String
    """Airline name."""
    airline: String
    """Airport ICAO or IATA code."""
    airportCode: String
    """Date/time the photo was taken (ISO 8601)."""
    takenAt: String
    """Tags to apply to the photo."""
    tags: [String!]
  }

  input UpdatePhotoInput {
    caption: String
    aircraftType: String
    airline: String
    airportCode: String
    takenAt: String
    tags: [String!]
  }

  # ─── Pagination ──────────────────────────────────────────────────────────

  """Relay-style connection for paginated user lists."""
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    cursor: String!
    node: User!
  }

  """Relay-style connection for paginated photo lists."""
  type PhotoConnection {
    edges: [PhotoEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PhotoEdge {
    cursor: String!
    node: Photo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  # ─── Comment Types ───────────────────────────────────────────────────────

  """A comment on a photo, with optional threaded replies."""
  type Comment {
    id: ID!
    """The user who wrote this comment."""
    user: User!
    """The comment text."""
    body: String!
    """Nested replies to this comment."""
    replies: [Comment!]!
    createdAt: String!
    updatedAt: String!
  }

  input AddCommentInput {
    """The photo to comment on."""
    photoId: ID!
    """The comment text (1-2000 characters)."""
    body: String!
    """Optional parent comment ID for threaded replies."""
    parentCommentId: ID
  }

  """Relay-style connection for paginated comment lists."""
  type CommentConnection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CommentEdge {
    cursor: String!
    node: Comment!
  }

  # ─── Report Types ──────────────────────────────────────────────────────

  """A content moderation report."""
  type Report {
    id: ID!
    """The type of content being reported."""
    targetType: String!
    """The ID of the reported content."""
    targetId: ID!
    """The reason for the report."""
    reason: String!
    """Optional description providing additional context."""
    description: String
    """Current status of the report."""
    status: String!
    createdAt: String!
  }

  input CreateReportInput {
    """Type of content: photo, comment, profile, or album."""
    targetType: String!
    """ID of the content to report."""
    targetId: ID!
    """Reason: inappropriate, spam, harassment, copyright, or other."""
    reason: String!
    """Additional details (required when reason is 'other')."""
    description: String
  }

  # ─── Follow Types ────────────────────────────────────────────────────────

  """Represents a single follow relationship."""
  type FollowEntry {
    id: ID!
    targetType: String!
    """The followed user (if targetType is 'user')."""
    user: User
    """The followed airport (if targetType is 'airport')."""
    airport: Airport
    """The followed value (if targetType is 'aircraft_type' or 'manufacturer')."""
    targetValue: String
    createdAt: String!
  }

  """Result of following/unfollowing a topic (aircraft_type or manufacturer)."""
  type FollowedTopic {
    targetType: String!
    value: String!
  }

  # ─── Album Types ──────────────────────────────────────────────────────────

  """A curated collection of photos created by a user."""
  type Album {
    id: ID!
    title: String!
    description: String
    isPublic: Boolean!
    """The user who created this album."""
    user: User!
    """Optional cover photo for the album."""
    coverPhoto: Photo
    """Total number of photos in this album."""
    photoCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type AlbumEdge {
    cursor: String!
    node: Album!
  }

  type AlbumConnection {
    edges: [AlbumEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateAlbumInput {
    """Album title (required, max 100 characters)."""
    title: String!
    """Optional description."""
    description: String
    """Whether the album is publicly visible. Defaults to true."""
    isPublic: Boolean
  }

  input UpdateAlbumInput {
    """New title for the album."""
    title: String
    """New description."""
    description: String
    """Toggle album visibility."""
    isPublic: Boolean
    """Set the cover photo. Must be a photo in this album."""
    coverPhotoId: ID
  }

  # ─── Airport & Location Types ────────────────────────────────────────────

  """An airport with geographic coordinates and associated photos."""
  type Airport {
    id: ID!
    icaoCode: String!
    iataCode: String
    name: String!
    city: String
    country: String
    latitude: Float!
    longitude: Float!
    """Number of photos taken at this airport."""
    photoCount: Int!
    """Spotting locations near this airport."""
    spottingLocations: [SpottingLocation!]!
    """Whether the authenticated user follows this airport."""
    isFollowedByMe: Boolean!
    """Number of users following this airport."""
    followerCount: Int!
  }

  """A known spotting location near an airport."""
  type SpottingLocation {
    id: ID!
    name: String!
    description: String
    accessNotes: String
    latitude: Float!
    longitude: Float!
    createdBy: User!
  }

  # ─── Health ──────────────────────────────────────────────────────────────

  type HealthCheck {
    status: String!
    timestamp: String!
    dbConnected: Boolean!
  }
`;
