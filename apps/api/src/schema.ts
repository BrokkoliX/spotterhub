import gql from 'graphql-tag';

export const typeDefs = gql`
  scalar JSON
  scalar Decimal

  enum PhotoSortBy {
    recent
    popular_day
    popular_week
    popular_month
    popular_all
  }

  enum UserRole {
    user
    moderator
    admin
    superuser
  }

  enum UserStatus {
    active
    suspended
    banned
  }

  enum ModerationStatus {
    pending
    approved
    rejected
    review
  }

  enum PhotoLicense {
    ALL_RIGHTS_RESERVED
    CC_BY_NC_ND
    CC_BY_NC
    CC_BY_NC_SA
    CC_BY
    CC_BY_SA
  }

  enum CommunityVisibility {
    public
    invite_only
  }

  enum FollowTargetType {
    user
    airport
    aircraft_type
    manufacturer
    family
    variant
    airline
    registration
  }

  enum ReportTargetType {
    photo
    comment
    profile
    album
    community
    forum_post
  }

  enum ReportReason {
    inappropriate
    spam
    harassment
    copyright
    other
  }

  enum ReportStatus {
    open
    reviewed
    resolved
    dismissed
  }

  enum CommunityRole {
    owner
    admin
    moderator
    member
  }

  enum EventRsvpStatus {
    going
    maybe
    not_going
  }

  enum NotificationType {
    like
    comment
    follow
    mention
    moderation
    system
    community_join
    community_event
  }

  enum LocationPrivacyMode {
    exact
    approximate
    hidden
  }

  enum OperatorType {
    AIRLINE
    GENERAL_AVIATION
    MILITARY
    GOVERNMENT
    CARGO
    CHARTER
    PRIVATE
  }

  enum OrderStatus {
    pending
    completed
    refunded
    failed
  }

  enum MarketplaceSort {
    newest
    price_asc
    price_desc
    rating_desc
  }

  enum SellerStatus {
    pending
    approved
    rejected
  }

  enum ItemCondition {
    mint
    excellent
    good
    fair
    poor
  }

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
    and filtering by user, album, airport, and tags.
    """
    photos(
      first: Int = 20
      after: String
      userId: ID
      albumId: ID
      airportCode: String
      tags: [String!]
      manufacturer: String
      family: String
      variant: String
      airline: String
      photographer: String
      sortBy: PhotoSortBy
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
    Distinct airline names matching a search string, for typeahead dropdowns.
    """
    searchAirlines(query: String!, first: Int = 10): [String!]!

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
    List all airports with optional search and pagination. Requires admin or superuser role.
    """
    adminAirports(search: String, first: Int = 50, after: String): AirportConnection!

    """
    Export all airports as a flat list. Requires admin or superuser role.
    """
    exportAirports: [Airport!]!

    """
    Fetch a single airport by ICAO or IATA code.
    """
    airport(code: String!): Airport

    """
    Minimal airport result for typeahead search — omits expensive relations.
    """
    searchAirports(query: String!, first: Int = 8): [AirportSearchResult!]!

    """
    Search aircraft by registration. Used for typeahead on the upload form.
    """
    aircraftSearch(search: String, first: Int = 20, after: String): AircraftConnection!

    """
    Fetch a single aircraft by registration.
    """
    aircraft(registration: String!): Aircraft

    """
    Paginated list of all aircraft registrations (admin only).
    """
    adminAircraft(search: String, first: Int = 50, after: String): AircraftConnection!

    """
    Fetch photos within a geographic bounding box.
    Uses PostGIS for spatial query.
    """
    photosInBounds(
      swLat: Float!
      swLng: Float!
      neLat: Float!
      neLng: Float!
      first: Int = 100
    ): [PhotoMapMarker!]!

    """
    Fetch photos near a point within a radius (in meters).
    Uses PostGIS ST_DWithin for spatial query.
    """
    photosNearby(
      latitude: Float!
      longitude: Float!
      radiusMeters: Float = 5000
      first: Int = 50
    ): [PhotoMapMarker!]!

    """
    Paginated comments for a photo. Returns top-level comments with nested replies.
    """
    comments(photoId: ID!, first: Int = 20, after: String): CommentConnection!

    # ─── Admin Queries ─────────────────────────────────────────────────────

    """
    Dashboard statistics for admins. Requires admin or moderator role.
    """
    adminStats: AdminStats!

    """
    Paginated list of reports, optionally filtered by status.
    Requires admin or moderator role.
    """
    adminReports(status: String, first: Int = 20, after: String): ReportConnection!

    """
    Paginated list of users for admin management.
    Optionally filter by role or status, and search by username/email.
    Requires admin or moderator role.
    """
    adminUsers(
      role: String
      status: String
      search: String
      first: Int = 20
      after: String
    ): UserConnection!

    """
    Paginated list of photos filtered by moderation status.
    Requires admin or moderator role.
    """
    adminPhotos(
      moderationStatus: String = "pending"
      first: Int = 20
      after: String
    ): PhotoConnection!

    # ─── Community Queries ──────────────────────────────────────────────────

    """
    Find a community by its URL slug.
    """
    community(slug: String!): Community

    """
    Browse/discover communities with optional search, category filter, and pagination.
    """
    communities(
      search: String
      category: String
      first: Int = 20
      after: String
    ): CommunityConnection!

    """
    List communities the current user is a member of.
    """
    myCommunities: [Community!]!

    """
    Paginated moderation log for a community. Requires owner or admin role.
    """
    communityModerationLogs(
      communityId: ID!
      action: String
      first: Int = 20
      after: String
    ): CommunityModerationLogConnection!

    """
    Paginated, filterable member list for a community. Requires owner or admin role.
    """
    communityMembers(communityId: ID!, filter: CommunityMemberFilter): CommunityMemberConnection!

    """
    Fetch site-wide settings (banner, tagline). Returns null if not set.
    """
    siteSettings: SiteSettings

    """
    Fetch ad configuration (enabled, AdSense client ID, slot IDs).
    """
    adSettings: AdSettings

    # ─── Forum Queries ───────────────────────────────────────────────────────

    """
    List all forum categories for a community, ordered by position.
    """
    forumCategories(communityId: ID!): [ForumCategory!]!

    """
    List all global forum categories (not tied to any community), ordered by position.
    """
    globalForumCategories: [ForumCategory!]!

    """
    Fetch a single forum category by ID.
    """
    forumCategory(id: ID!): ForumCategory

    """
    Paginated list of threads in a category. Pinned threads appear first.
    """
    forumThreads(categoryId: ID!, first: Int, after: String): ForumThreadConnection!

    """
    Fetch a single forum thread by ID.
    """
    forumThread(id: ID!): ForumThread

    """
    Paginated top-level posts in a thread, oldest first.
    """
    forumPosts(threadId: ID!, first: Int, after: String): ForumPostConnection!

    # ─── Event Queries ───────────────────────────────────────────────────────

    """
    List events for a community, ordered by startsAt asc. Defaults to upcoming only.
    """
    communityEvents(
      communityId: ID!
      first: Int = 20
      after: String
      includePast: Boolean
    ): CommunityEventConnection!

    """
    Fetch a single event by ID.
    """
    communityEvent(id: ID!): CommunityEvent

    # ─── Notification Queries ─────────────────────────────────────────────

    """
    Paginated list of the current user's notifications, newest first.
    """
    notifications(first: Int, after: String, unreadOnly: Boolean): NotificationConnection!

    """
    Count of unread notifications for the current user. Returns 0 if unauthenticated.
    """
    unreadNotificationCount: Int!

    # ─── Aircraft Hierarchy Queries ──────────────────────────────────────────

    """
    List all aircraft manufacturers with optional search and pagination.
    """
    aircraftManufacturers(
      search: String
      first: Int = 20
      after: String
    ): AircraftManufacturerConnection!

    """
    List aircraft families, optionally filtered by manufacturer.
    """
    aircraftFamilies(
      manufacturerId: ID
      search: String
      first: Int = 20
      after: String
    ): AircraftFamilyConnection!

    """
    List aircraft variants, optionally filtered by family.
    """
    aircraftVariants(
      familyId: ID
      search: String
      first: Int = 20
      after: String
    ): AircraftVariantConnection!

    """
    List all airlines with optional search and pagination.
    """
    airlines(search: String, first: Int = 20, after: String): AirlineConnection!

    """
    Fetch a single airline by ICAO code for auto-fill.
    """
    airline(icaoCode: String!): Airline

    """
    List all photo categories.
    """
    photoCategories: [PhotoCategory!]!

    """
    List all aircraft-specific categories.
    """
    aircraftSpecificCategories: [AircraftSpecificCategory!]!

    # ─── Marketplace Queries ────────────────────────────────────────────────

    """
    Browse photos listed for sale in the marketplace.
    Returns photos with active listings, sorted by creation date or price.
    """
    marketplaceListings(
      first: Int = 20
      after: String
      sortBy: MarketplaceSort
    ): MarketplaceListingConnection!

    """
    Paginated list of the current user's purchases.
    Requires authentication.
    """
    myPurchases(first: Int = 20, after: String): OrderConnection!

    """
    Paginated list of the current user's sales.
    Requires authentication.
    """
    mySales(first: Int = 20, after: String): OrderConnection!

    """
    List of all pending seller applications. Requires admin or superuser role.
    """
    adminSellerApplications(first: Int = 20, after: String): SellerProfileConnection!

    # ─── Admin: Pending List Items ───────────────────────────────────────────

    """
    Paginated list of pending list items for admin review.
    """
    pendingListItems(
      status: String
      listType: String
      first: Int = 20
      after: String
    ): PendingListItemConnection!

    # ─── Collectibles Marketplace Queries ─────────────────────────────────────────

    """
    Browse collectibles listings with optional filters and sorting.
    Only returns approved items with approved sellers.
    """
    marketplaceItems(
      category: String
      minPrice: Float
      maxPrice: Float
      condition: String
      search: String
      sortBy: MarketplaceSort
      first: Int = 20
      after: String
    ): MarketplaceItemConnection!

    """
    Fetch a single collectible listing by ID.
    """
    marketplaceItem(id: ID!): MarketplaceItem

    """
    List all marketplace categories.
    """
    marketplaceCategories: [MarketplaceCategory!]!

    """
    Fetch a seller's public profile with their listings and ratings.
    """
    sellerProfile(userId: ID!): SellerProfile

    """
    Paginated feedback for a seller.
    """
    sellerFeedback(sellerId: ID!, first: Int = 20, after: String): SellerFeedbackConnection!

    """
    My marketplace listings (seller).
    """
    myListings(first: Int = 20, after: String): MarketplaceItemConnection!

    """
    Admin: all marketplace items, optionally filtered by moderation status.
    """
    adminMarketplaceItems(
      moderationStatus: String
      first: Int = 20
      after: String
    ): MarketplaceItemConnection!
  }

  type Mutation {
    """
    Register a new user account (dev mode — creates user + issues JWT).
    In production, registration is handled by AWS Cognito.
    """
    signUp(input: SignUpInput!): SignUpPayload!

    """
    Sign in with email and password (dev mode — validates credentials + issues JWT).
    In production, authentication is handled by AWS Cognito.
    """
    signIn(input: SignInInput!): AuthPayload!

    """
    Exchange a valid refresh_token HttpOnly cookie for a new short-lived access token.
    Implements token rotation: the old refresh token is deleted and a new one is issued.
    """
    refreshToken: AuthPayload!

    """
    Sign out: clears the access_token and refresh_token HttpOnly cookies,
    and invalidates the refresh token in the database.
    """
    signOut: Boolean!

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
    Soft-delete a photo. Requires admin or moderator role.
    """
    softDeletePhoto(id: ID!, reason: String): Boolean!

    """
    Permanently delete a photo. Requires admin or moderator role and a reason.
    """
    hardDeletePhoto(id: ID!, reason: String!): Boolean!

    """
    Regenerate image variants (thumbnail, display, watermark) for an existing photo.
    Useful when variants failed to generate during upload. Owner or admin only.
    """
    regeneratePhotoVariants(photoId: ID!): Photo!

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
    Follow a topic (manufacturer, family, or variant). Idempotent.
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
    Soft-delete a comment. Requires admin or moderator role.
    """
    softDeleteComment(id: ID!, reason: String): Boolean!

    """
    Permanently delete a comment. Requires admin or moderator role and a reason.
    """
    hardDeleteComment(id: ID!, reason: String!): Boolean!

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
    Soft-delete an album. Requires admin or moderator role.
    """
    softDeleteAlbum(id: ID!, reason: String): Boolean!

    """
    Permanently delete an album. Requires admin or moderator role and a reason.
    Photos are unlinked from the album but not deleted.
    """
    hardDeleteAlbum(id: ID!, reason: String!): Boolean!

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
    Create a community-scoped album. Requires community owner or admin role.
    """
    createCommunityAlbum(communityId: ID!, input: CreateAlbumInput!): Album!

    """
    Add photos to a community album. Any active community member can add
    their own previously-uploaded photos.
    """
    addPhotosToCommunityAlbum(albumId: ID!, photoIds: [ID!]!): Album!

    """
    Remove photos from a community album. The member who added the photo
    or a community admin can remove it.
    """
    removePhotosFromCommunityAlbum(albumId: ID!, photoIds: [ID!]!): Album!

    """
    Report content (photo, comment, profile, or album) for moderation review.
    Duplicate reports on the same target are prevented.
    """
    createReport(input: CreateReportInput!): Report!

    """
    Create a spotting location near an airport. Requires authentication.
    """
    createSpottingLocation(input: CreateSpottingLocationInput!): SpottingLocation!

    """
    Delete a spotting location. Only the creator can delete.
    """
    deleteSpottingLocation(id: ID!): Boolean!

    """
    Create an aircraft record. Requires admin or superuser role.
    """
    createAircraft(input: CreateAircraftInput!): Aircraft!

    """
    Update an aircraft record. Requires admin or superuser role.
    """
    updateAircraft(id: ID!, input: UpdateAircraftInput!): Aircraft!

    """
    Delete an aircraft record. Requires admin or superuser role.
    """
    deleteAircraft(id: ID!): Boolean!

    """
    Upsert an aircraft record by registration. Requires admin or superuser role.
    """
    upsertAircraft(input: CreateAircraftInput!): Aircraft!

    """
    Submit a new aircraft for approval. Any authenticated user can submit
    a registration that doesn't exist yet. The aircraft starts in PENDING_APPROVAL
    status and must be approved by an admin/moderator before it becomes active.
    """
    createPendingAircraft(input: CreateAircraftInput!): Aircraft!

    """
    Approve a pending aircraft. Only admin, moderator, or superuser can approve.
    Once approved, the aircraft becomes active and can be linked to photos.
    """
    approveAircraft(id: ID!): Aircraft!

    """
    Reject a pending aircraft. Only admin or superuser can reject.
    The aircraft record is deleted.
    """
    rejectAircraft(id: ID!): Boolean!

    # ─── Admin Mutations ───────────────────────────────────────────────────

    """
    Resolve or dismiss a report. Requires admin or moderator role.
    """
    adminResolveReport(id: ID!, action: String!): Report!

    """
    Update a user's account status (active, suspended, banned).
    Requires admin or superuser role.
    """
    adminUpdateUserStatus(userId: ID!, status: String!): User!

    """
    Update a user's role (user, moderator, admin).
    Requires admin or superuser role.
    """
    adminUpdateUserRole(userId: ID!, role: String!): User!

    """
    Update a photo's moderation status (approved, rejected, pending, review).
    Requires admin or moderator role.
    """
    adminUpdatePhotoModeration(photoId: ID!, status: String!): Photo!

    """
    Approve a pending photo, making it visible in the public feed.
    Requires admin or moderator role.
    """
    approvePhoto(photoId: ID!): Photo!

    """
    Reject a pending photo. Requires admin or moderator role.
    """
    rejectPhoto(photoId: ID!, reason: String): Photo!

    """
    Create an airport. Requires admin or superuser role.
    """
    createAirport(input: CreateAirportInput!): Airport!

    """
    Update an airport. Requires admin or superuser role.
    """
    updateAirport(id: ID!, input: UpdateAirportInput!): Airport!

    """
    Upsert an airport by ICAO code. If exists, updates; otherwise creates.
    Requires admin or superuser role.
    """
    upsertAirport(input: CreateAirportInput!): Airport!

    """
    Delete an airport. Fails if any photos reference this airport.
    Requires admin or superuser role.
    """
    deleteAirport(id: ID!): Boolean!

    # ─── Community Mutations ────────────────────────────────────────────────

    """
    Create a new community. The creator automatically becomes the owner.
    """
    createCommunity(input: CreateCommunityInput!): Community!

    """
    Update a community's details. Requires owner or community admin role.
    """
    updateCommunity(id: ID!, input: UpdateCommunityInput!): Community!

    """
    Delete a community. Requires owner role.
    """
    deleteCommunity(id: ID!): Boolean!

    """
    Update site-wide settings (banner, tagline). Requires admin or superuser role.
    """
    updateSiteSettings(input: UpdateSiteSettingsInput!): SiteSettings!

    """
    Update ad configuration (enabled, AdSense client ID, slot IDs). Requires superuser role.
    """
    updateAdSettings(input: UpdateAdSettingsInput!): AdSettings!

    """
    Join a public community, or join an invite-only community with a valid invite code.
    """
    joinCommunity(communityId: ID!, inviteCode: String): CommunityMember!

    """
    Leave a community. Owners cannot leave (must transfer ownership or delete).
    """
    leaveCommunity(communityId: ID!): Boolean!

    """
    Remove a member from a community. Requires owner, admin, or moderator role.
    Cannot remove members with equal or higher roles.
    """
    removeCommunityMember(communityId: ID!, userId: ID!): Boolean!

    """
    Update a member's role within a community.
    Requires owner or admin role. Cannot promote above own role.
    """
    updateCommunityMemberRole(communityId: ID!, userId: ID!, role: String!): CommunityMember!

    """
    Transfer ownership of this community to another member.
    The previous owner becomes an admin. Requires current owner.
    """
    transferCommunityOwnership(communityId: ID!, userId: ID!): Community!

    """
    Generate or regenerate the invite code for an invite-only community.
    Requires owner or admin role.
    """
    generateInviteCode(communityId: ID!): Community!

    """
    Ban a member from the community. Sets their status to banned.
    They cannot rejoin until unbanned. Requires owner or admin role.
    Cannot ban members with equal or higher role.
    """
    banCommunityMember(communityId: ID!, userId: ID!, reason: String): CommunityMember!

    """
    Unban a previously banned member. Resets status to active.
    Requires owner or admin role.
    """
    unbanCommunityMember(communityId: ID!, userId: ID!): CommunityMember!

    """
    Delete a photo in a community. Requires owner, admin, or moderator role.
    Logs the action to the community moderation log.
    """
    deleteCommunityPhoto(communityId: ID!, photoId: ID!, reason: String): Boolean!

    """
    Delete a comment in a community. Requires owner, admin, or moderator role.
    Logs the action to the community moderation log.
    """
    deleteCommunityComment(communityId: ID!, commentId: ID!, reason: String): Boolean!

    """
    Delete a forum thread in a community. Requires owner, admin, or moderator role.
    Logs the action to the community moderation log.
    """
    deleteCommunityThread(communityId: ID!, threadId: ID!, reason: String): Boolean!

    """
    Soft-delete a forum post in a community. Requires owner, admin, or moderator role.
    The post body is replaced with '[deleted]'. Logs the action.
    """
    deleteCommunityPost(communityId: ID!, postId: ID!, reason: String): Boolean!

    # ─── Forum Mutations ────────────────────────────────────────────────────

    """
    Create a forum category in a community. Requires owner or admin role. Pass communityId: null for global categories (admin only).
    """
    createForumCategory(
      communityId: ID
      name: String!
      description: String
      slug: String
    ): ForumCategory!

    """
    Create a global forum category (not tied to any community). Requires admin or superuser role.
    """
    createGlobalForumCategory(name: String!, description: String, slug: String): ForumCategory!

    """
    Update a forum category. Requires owner or admin role.
    """
    updateForumCategory(id: ID!, name: String, description: String, position: Int): ForumCategory!

    """
    Delete a forum category and all its threads. Requires owner or admin role.
    """
    deleteForumCategory(id: ID!): Boolean!

    """
    Create a new thread in a forum category. Any active community member.
    """
    createForumThread(categoryId: ID!, title: String!, body: String!): ForumThread!

    """
    Delete a forum thread. Requires thread authorship or moderator+ role.
    """
    deleteForumThread(id: ID!): Boolean!

    """
    Soft-delete a forum thread. Requires admin or moderator role.
    """
    softDeleteForumThread(id: ID!, reason: String): Boolean!

    """
    Permanently delete a forum thread. Requires admin or moderator role and a reason.
    """
    hardDeleteForumThread(id: ID!, reason: String!): Boolean!

    """
    Pin or unpin a thread. Requires moderator+ role.
    """
    pinForumThread(id: ID!, pinned: Boolean!): ForumThread!

    """
    Lock or unlock a thread. Requires moderator+ role.
    """
    lockForumThread(id: ID!, locked: Boolean!): ForumThread!

    """
    Post a reply in a thread. Any active community member.
    """
    createForumPost(threadId: ID!, body: String!, parentPostId: ID): ForumPost!

    """
    Edit a post body. Author only, within 24 hours of creation.
    """
    updateForumPost(id: ID!, body: String!): ForumPost!

    """
    Soft-delete a post. Author or moderator+.
    """
    deleteForumPost(id: ID!): Boolean!

    """
    Permanently delete a forum post. Requires admin or moderator role and a reason.
    """
    hardDeleteForumPost(id: ID!, reason: String!): Boolean!

    # ─── Event Mutations ──────────────────────────────────────────────────

    """
    Create an event in a community. Requires owner or admin role.
    """
    createCommunityEvent(communityId: ID!, input: CreateCommunityEventInput!): CommunityEvent!

    """
    Update an event. Requires owner/admin or the event organizer.
    """
    updateCommunityEvent(id: ID!, input: UpdateCommunityEventInput!): CommunityEvent!

    """
    Delete an event. Requires owner/admin or the event organizer.
    """
    deleteCommunityEvent(id: ID!): Boolean!

    """
    RSVP to an event. status: going | maybe | not_going.
    """
    rsvpEvent(eventId: ID!, status: String!): EventAttendee!

    """
    Cancel your RSVP (remove the attendance record).
    """
    cancelRsvp(eventId: ID!): Boolean!

    # ─── Notification Mutations ───────────────────────────────────────────

    """
    Mark a single notification as read. Must be the notification owner.
    """
    markNotificationRead(id: ID!): Notification!

    """
    Mark all of the current user's notifications as read.
    """
    markAllNotificationsRead: Boolean!

    """
    Delete a notification. Must be the notification owner.
    """
    deleteNotification(id: ID!): Boolean!

    """
    Request a password reminder email. Always returns true to prevent email enumeration.
    """
    requestPasswordReminder(email: String!): Boolean!

    """
    Request a password reset email. Always returns true to prevent email enumeration.
    """
    requestPasswordReset(email: String!): Boolean!

    """
    Reset password using a token from the email link. Token is single-use and expires in 1 hour.
    """
    resetPassword(token: String!, newPassword: String!): AuthPayload!

    """
    Verify an email address using the token sent during sign-up.
    """
    verifyEmail(token: String!): AuthPayload!

    # ─── Aircraft Hierarchy Mutations (Admin) ────────────────────────────────

    """
    Create an aircraft manufacturer. Requires admin or superuser role.
    """
    createManufacturer(input: CreateManufacturerInput!): AircraftManufacturer!

    """
    Update an aircraft manufacturer. Requires admin or superuser role.
    """
    updateManufacturer(id: ID!, input: UpdateManufacturerInput!): AircraftManufacturer!

    """
    Delete an aircraft manufacturer. Requires admin or superuser role.
    """
    deleteManufacturer(id: ID!): Boolean!

    """
    Upsert an aircraft manufacturer by unique name. Requires admin or superuser role.
    """
    upsertManufacturer(input: CreateManufacturerInput!): AircraftManufacturer!

    """
    Create an aircraft family. Requires admin or superuser role.
    """
    createFamily(input: CreateFamilyInput!): AircraftFamily!

    """
    Update an aircraft family. Requires admin or superuser role.
    """
    updateFamily(id: ID!, input: UpdateFamilyInput!): AircraftFamily!

    """
    Delete an aircraft family. Requires admin or superuser role.
    """
    deleteFamily(id: ID!): Boolean!

    """
    Upsert an aircraft family by unique name. Requires admin or superuser role.
    """
    upsertFamily(input: CreateFamilyInput!): AircraftFamily!

    """
    Create an aircraft variant. Requires admin or superuser role.
    """
    createVariant(input: CreateVariantInput!): AircraftVariant!

    """
    Update an aircraft variant. Requires admin or superuser role.
    """
    updateVariant(id: ID!, input: UpdateVariantInput!): AircraftVariant!

    """
    Delete an aircraft variant. Requires admin or superuser role.
    """
    deleteVariant(id: ID!): Boolean!

    """
    Upsert an aircraft variant by unique name. Requires admin or superuser role.
    """
    upsertVariant(input: CreateVariantInput!): AircraftVariant!

    """
    Create an airline. Requires admin or superuser role.
    """
    createAirline(input: CreateAirlineInput!): Airline!

    """
    Update an airline. Requires admin or superuser role.
    """
    updateAirline(id: ID!, input: UpdateAirlineInput!): Airline!

    """
    Delete an airline. Requires admin or superuser role.
    """
    deleteAirline(id: ID!): Boolean!

    """
    Upsert an airline by unique name. Requires admin or superuser role.
    """
    upsertAirline(input: CreateAirlineInput!): Airline!

    """
    Create a photo category. Requires admin or superuser role.
    """
    createPhotoCategory(input: CreatePhotoCategoryInput!): PhotoCategory!

    """
    Update a photo category. Requires admin or superuser role.
    """
    updatePhotoCategory(id: ID!, input: UpdatePhotoCategoryInput!): PhotoCategory!

    """
    Delete a photo category. Requires admin or superuser role.
    """
    deletePhotoCategory(id: ID!): Boolean!

    """
    Upsert a photo category by unique name. Requires admin or superuser role.
    """
    upsertPhotoCategory(input: CreatePhotoCategoryInput!): PhotoCategory!

    """
    Create an aircraft-specific category. Requires admin or superuser role.
    """
    createAircraftSpecificCategory(
      input: CreateAircraftSpecificCategoryInput!
    ): AircraftSpecificCategory!

    """
    Update an aircraft-specific category. Requires admin or superuser role.
    """
    updateAircraftSpecificCategory(
      id: ID!
      input: UpdateAircraftSpecificCategoryInput!
    ): AircraftSpecificCategory!

    """
    Delete an aircraft-specific category. Requires admin or superuser role.
    """
    deleteAircraftSpecificCategory(id: ID!): Boolean!

    """
    Upsert an aircraft-specific category by unique name. Requires admin or superuser role.
    """
    upsertAircraftSpecificCategory(
      input: CreateAircraftSpecificCategoryInput!
    ): AircraftSpecificCategory!

    # ─── Marketplace Mutations ──────────────────────────────────────────────────

    """
    Apply to become a seller. Creates a SellerProfile in pending state.
    """
    applyToSell(input: ApplyToSellInput!): SellerProfile!

    """
    Approve a seller application. Creates a Stripe Connect account and returns onboarding link.
    """
    approveSeller(sellerProfileId: ID!): ApproveSellerPayload!

    """
    Create or update a listing for one of your approved photos.
    """
    createOrUpdateListing(input: CreateOrUpdateListingInput!): PhotoListing!

    """
    Remove a listing from a photo. Works for the photo owner.
    """
    removeListing(photoId: ID!): Boolean!

    # ─── Collectibles Marketplace Mutations ────────────────────────────────

    """
    Update a seller's status (approve/reject). Requires admin or superuser role.
    """
    updateSellerStatus(sellerProfileId: ID!, status: SellerStatus!): SellerProfile!

    """
    Create a new collectible listing. Requires approved seller status.
    """
    createMarketplaceItem(input: CreateMarketplaceItemInput!): MarketplaceItem!

    """
    Update an existing collectible listing. Only the seller can update.
    """
    updateMarketplaceItem(id: ID!, input: UpdateMarketplaceItemInput!): MarketplaceItem!

    """
    Delete a collectible listing. Only the seller can delete.
    """
    deleteMarketplaceItem(id: ID!): Boolean!

    """
    Moderate a collectible listing (approve/reject). Requires admin or moderator role.
    """
    moderateMarketplaceItem(id: ID!, status: ModerationStatus!, reason: String): MarketplaceItem!

    """
    Submit feedback for a seller after contacting them. One feedback per buyer per seller.
    """
    submitSellerFeedback(input: SubmitSellerFeedbackInput!): SellerFeedback!

    """
    Request a presigned S3 URL for uploading a marketplace item image.
    """
    getMarketplaceItemUploadUrl(input: GetUploadUrlInput!): UploadUrlPayload!

    # ─── Admin: Marketplace Categories ──────────────────────────────────

    """
    Create a marketplace category. Requires admin or superuser role.
    """
    createMarketplaceCategory(input: CreateMarketplaceCategoryInput!): MarketplaceCategory!

    """
    Update a marketplace category. Requires admin or superuser role.
    """
    updateMarketplaceCategory(id: ID!, input: UpdateMarketplaceCategoryInput!): MarketplaceCategory!

    """
    Delete a marketplace category. Requires admin or superuser role.
    """
    deleteMarketplaceCategory(id: ID!): Boolean!

    """
    Initiate a photo purchase. Returns Stripe Checkout URL.
    """
    createPhotoPurchase(listingId: ID!): PurchasePayload!

    # ─── List Contribution (User) ────────────────────────────────────────────

    """
    Submit a new item for addition to a lookup list. Requires authentication.
    """
    submitListItem(input: SubmitListItemInput!): PendingListItem!

    # ─── List Review (Admin) ────────────────────────────────────────────────

    """
    Review a pending list item (approve or reject). Requires admin or superuser role.
    """
    reviewListItem(id: ID!, status: String!, reviewNote: String): PendingListItem!
  }

  # ─── Auth Types ──────────────────────────────────────────────────────────

  input SignUpInput {
    """
    Email address for the new account.
    """
    email: String!
    """
    Unique username (3-30 chars, alphanumeric + hyphens/underscores).
    """
    username: String!
    """
    Password (min 8 characters).
    """
    password: String!
    """
    Display name shown on your profile.
    """
    displayName: String
  }

  input SignInInput {
    """
    Email address.
    """
    email: String!
    """
    Password.
    """
    password: String!
  }

  """
  Returned after successful authentication. Contains the short-lived JWT access token,
  the refresh token (opaque token in HttpOnly cookie), and the authenticated user record.
  """
  type AuthPayload {
    """
    Short-lived JWT access token (1 hour). Sent via HttpOnly cookie on browser requests.
    """
    token: String!
    """
    Opaque refresh token — stored in DB and sent via HttpOnly cookie. Used to obtain new access tokens.
    """
    refreshToken: String
    """
    The authenticated user.
    """
    user: User!
  }

  """
  Response after a successful sign-up. No token is returned — user must verify email first.
  """
  type SignUpPayload {
    """
    The created user (email not yet verified).
    """
    user: User!
  }

  # ─── User & Profile Types ────────────────────────────────────────────────

  """
  A registered SpotterSpace user.
  """
  type User {
    id: ID!
    """
    Unique email address.
    """
    email: String!
    """
    Unique username, used in profile URLs (/u/username).
    """
    username: String!
    """
    Platform role: user, moderator, or admin.
    """
    role: UserRole!
    """
    Account status: active, suspended, or banned.
    """
    status: UserStatus!
    """
    Whether the email has been verified.
    """
    emailVerified: Boolean!
    """
    The user's profile, if one has been created.
    """
    profile: Profile
    """
    Number of users following this user.
    """
    followerCount: Int!
    """
    Number of users this user follows.
    """
    followingCount: Int!
    """
    Whether the currently authenticated user follows this user.
    """
    isFollowedByMe: Boolean!
    """
    Number of photos uploaded by this user.
    """
    photoCount: Int!
    """
    The user's seller profile, if any.
    """
    sellerProfile: SellerProfile
    """
    Whether the user can sell (approved seller or admin/superuser).
    """
    canSell: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  """
  A user's public profile with biographical and preference information.
  """
  type Profile {
    id: ID!
    """
    Display name shown on the profile page.
    """
    displayName: String
    """
    Free-form biography text.
    """
    bio: String
    """
    URL to the user's avatar image.
    """
    avatarUrl: String
    """
    Geographic region (e.g., 'Pacific Northwest, USA').
    """
    locationRegion: String
    """
    Self-reported experience level for aviation spotting.
    """
    experienceLevel: String
    """
    Camera/lens gear description.
    """
    gear: String
    """
    List of spotting interests (e.g., military, commercial, GA).
    """
    interests: [String!]!
    """
    Favorite aircraft types (e.g., A380, 747, F-16).
    """
    favoriteAircraft: [String!]!
    """
    Favorite airport codes.
    """
    favoriteAirports: [String!]!
    """
    Whether this profile is publicly visible.
    """
    isPublic: Boolean!
    """
    Camera bodies in the user's gear list.
    """
    cameraBodies: [String!]!
    """
    Lenses in the user's gear list.
    """
    lenses: [String!]!
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
    cameraBodies: [String!]
    lenses: [String!]
  }

  # ─── Photo Types ─────────────────────────────────────────────────────────

  """
  An uploaded aviation photo with metadata and processing variants.
  """
  type Photo {
    id: ID!
    """
    The user who uploaded this photo.
    """
    user: User!
    """
    The album this photo belongs to, if any.
    """
    albumId: ID
    """
    Photo caption or description.
    """
    caption: String
    """
    Airline name.
    """
    airline: String
    """
    Airport ICAO or IATA code where the photo was taken.
    """
    airportCode: String
    """
    Date/time the photo was taken (from EXIF or user input).
    """
    takenAt: String
    """
    URL to the original uploaded image.
    """
    originalUrl: String!
    """
    Original image width in pixels.
    """
    originalWidth: Int
    """
    Original image height in pixels.
    """
    originalHeight: Int
    """
    Original file size in bytes.
    """
    fileSizeBytes: Int
    """
    MIME type of the original file.
    """
    mimeType: String
    """
    Content moderation status.
    """
    moderationStatus: ModerationStatus!
    """
    Generated image variants (thumbnail, display, etc.).
    """
    variants: [PhotoVariant!]!
    """
    User-applied tags.
    """
    tags: [String!]!
    """
    Photo location with privacy-filtered coordinates.
    """
    location: PhotoLocation
    """
    Number of likes on this photo.
    """
    likeCount: Int!
    """
    Number of comments on this photo.
    """
    commentCount: Int!
    """
    License under which the photo is published.
    """
    license: PhotoLicense!
    """
    Whether a watermarked variant should be generated.
    """
    watermarkEnabled: Boolean!
    """
    Whether the currently authenticated user has liked this photo.
    """
    isLikedByMe: Boolean!
    """
    Linked aircraft record, if any.
    """
    aircraft: Aircraft
    """
    The person who took the photo (defaults to uploader).
    """
    photographer: User
    """
    Name of the photographer.
    """
    photographerName: String
    """
    Camera body used.
    """
    gearBody: String
    """
    Lens used.
    """
    gearLens: String
    """
    Full EXIF data as JSON.
    """
    exifData: JSON
    """
    Photo category (e.g., cabin, cockpit, exterior).
    """
    photoCategory: PhotoCategory
    """
    Aircraft-specific category (e.g., vintage, narrowbody).
    """
    aircraftSpecificCategory: AircraftSpecificCategory
    """
    Operator ICAO code (e.g., 'AAL' for American Airlines).
    """
    operatorIcao: String
    """
    Operator type (AIRLINE, GENERAL_AVIATION, MILITARY, etc.).
    """
    operatorType: OperatorType
    """
    Aircraft serial number (MSN).
    """
    msn: String
    """
    Aircraft manufacturing date.
    """
    manufacturingDate: String
    createdAt: String!
    updatedAt: String!

    """
    Whether this photo has been soft-deleted by an admin.
    """
    isDeleted: Boolean!

    """
    The active marketplace listing for this photo, if any.
    """
    listing: PhotoListing

    """
    Whether this photo has an active marketplace listing.
    """
    hasActiveListing: Boolean!

    """
    Other photos of the same aircraft (matched by serial number or linked aircraft record).
    """
    similarAircraftPhotos(first: Int = 12, after: String): PhotoConnection!
  }

  """
  A processed image variant (thumbnail, display, etc.).
  """
  type PhotoVariant {
    id: ID!
    """
    The variant type: thumbnail, display, full_res, or watermarked.
    """
    variantType: String!
    """
    URL to access this variant.
    """
    url: String!
    """
    Variant width in pixels.
    """
    width: Int!
    """
    Variant height in pixels.
    """
    height: Int!
    """
    Variant file size in bytes.
    """
    fileSizeBytes: Int
  }

  input GetUploadUrlInput {
    """
    MIME type of the file to upload (image/jpeg, image/png, etc.).
    """
    mimeType: String!
    """
    File size in bytes (for tier limit validation).
    """
    fileSizeBytes: Int!
  }

  """
  Presigned URL payload for client-side S3 upload.
  """
  type UploadUrlPayload {
    """
    Presigned PUT URL — upload the file directly to this URL.
    """
    url: String!
    """
    S3 object key — pass this to createPhoto after upload completes.
    """
    key: String!
  }

  input CreatePhotoInput {
    """
    S3 object key returned from getUploadUrl.
    """
    s3Key: String!
    """
    MIME type of the uploaded file.
    """
    mimeType: String!
    """
    File size in bytes.
    """
    fileSizeBytes: Int!
    """
    Photo caption or description.
    """
    caption: String
    """
    Airline name.
    """
    airline: String
    """
    Airport ICAO or IATA code.
    """
    airportCode: String
    """
    Date/time the photo was taken (ISO 8601).
    """
    takenAt: String
    """
    Tags to apply to the photo.
    """
    tags: [String!]
    """
    Latitude of where the photo was taken.
    """
    latitude: Float
    """
    Longitude of where the photo was taken.
    """
    longitude: Float
    """
    Location privacy mode: exact (default), approximate, or hidden.
    """
    locationPrivacy: LocationPrivacyMode
    """
    Link to a structured Aircraft record.
    """
    aircraftId: ID
    """
    Camera body used (from user's gear list).
    """
    gearBody: String
    """
    Lens used (from user's gear list).
    """
    gearLens: String
    """
    Full EXIF data as JSON.
    """
    exifData: JSON
    """
    Photo category ID.
    """
    photoCategoryId: ID
    """
    Aircraft-specific category ID.
    """
    aircraftSpecificCategoryId: ID
    """
    Operator ICAO code.
    """
    operatorIcao: String
    """
    Operator type (AIRLINE, GENERAL_AVIATION, MILITARY, etc.).
    """
    operatorType: OperatorType
    """
    Aircraft serial number (MSN).
    """
    msn: String
    """
    Aircraft manufacturing date.
    """
    manufacturingDate: String
    """
    Location type: airport, museum, cemetery, airfield, other.
    """
    locationType: String
    """
    Airport ICAO code for location lookup.
    """
    airportIcao: String
    """
    License for the photo.
    """
    license: PhotoLicense
    """
    Whether to generate a watermarked variant.
    """
    watermarkEnabled: Boolean
  }

  input UpdatePhotoInput {
    caption: String
    airline: String
    airportCode: String
    takenAt: String
    tags: [String!]
    latitude: Float
    longitude: Float
    locationPrivacy: LocationPrivacyMode
    aircraftId: ID
    gearBody: String
    gearLens: String
    exifData: JSON
    photoCategoryId: ID
    aircraftSpecificCategoryId: ID
    operatorIcao: String
    operatorType: OperatorType
    msn: String
    manufacturingDate: String
    locationType: String
    airportIcao: String
  }

  # ─── Pagination ──────────────────────────────────────────────────────────

  """
  Relay-style connection for paginated user lists.
  """
  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    cursor: String!
    node: User!
  }

  """
  Relay-style connection for paginated photo lists.
  """
  type PhotoConnection {
    edges: [PhotoEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AircraftConnection {
    edges: [AircraftEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AircraftEdge {
    cursor: String!
    node: Aircraft!
  }

  type AirportConnection {
    edges: [AirportEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AirportEdge {
    cursor: String!
    node: Airport!
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

  """
  A comment on a photo, with optional threaded replies.
  """
  type Comment {
    id: ID!
    """
    The user who wrote this comment.
    """
    user: User!
    """
    The comment text.
    """
    body: String!
    """
    Nested replies to this comment.
    """
    replies: [Comment!]!
    createdAt: String!
    updatedAt: String!
    """
    Whether this comment has been soft-deleted by an admin.
    """
    isDeleted: Boolean!
  }

  input AddCommentInput {
    """
    The photo to comment on.
    """
    photoId: ID!
    """
    The comment text (1-2000 characters).
    """
    body: String!
    """
    Optional parent comment ID for threaded replies.
    """
    parentCommentId: ID
  }

  """
  Relay-style connection for paginated comment lists.
  """
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

  """
  A content moderation report.
  """
  type Report {
    id: ID!
    """
    The type of content being reported.
    """
    targetType: ReportTargetType!
    """
    The ID of the reported content.
    """
    targetId: ID!
    """
    The reason for the report.
    """
    reason: ReportReason!
    """
    Optional description providing additional context.
    """
    description: String
    """
    Current status of the report.
    """
    status: ReportStatus!
    """
    The user who submitted the report.
    """
    reporter: User!
    """
    The admin/moderator who reviewed the report.
    """
    reviewer: User
    createdAt: String!
    """
    When the report was resolved.
    """
    resolvedAt: String
  }

  type ReportEdge {
    cursor: String!
    node: Report!
  }

  type ReportConnection {
    edges: [ReportEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ─── Admin Types ──────────────────────────────────────────────────────

  """
  Dashboard statistics for the admin panel.
  """
  type AdminStats {
    totalUsers: Int!
    totalPhotos: Int!
    pendingPhotos: Int!
    openReports: Int!
    totalAirports: Int!
    totalSpottingLocations: Int!
  }

  input CreateReportInput {
    """
    Type of content: photo, comment, profile, album, community, or forum_post.
    """
    targetType: ReportTargetType!
    """
    ID of the content to report.
    """
    targetId: ID!
    """
    Reason: inappropriate, spam, harassment, copyright, or other.
    """
    reason: ReportReason!
    """
    Additional details (required when reason is 'other').
    """
    description: String
  }

  # ─── Follow Types ────────────────────────────────────────────────────────

  """
  Represents a single follow relationship.
  """
  type FollowEntry {
    id: ID!
    targetType: FollowTargetType!
    """
    The followed user (if targetType is 'user').
    """
    user: User
    """
    The followed airport (if targetType is 'airport').
    """
    airport: Airport
    """
    The followed value (if targetType is 'manufacturer', 'family', or 'variant').
    """
    targetValue: String
    createdAt: String!
  }

  """
  Result of following/unfollowing a topic (manufacturer, family, or variant).
  """
  type FollowedTopic {
    targetType: String!
    value: String!
  }

  # ─── Album Types ──────────────────────────────────────────────────────────

  """
  A curated collection of photos created by a user.
  """
  type Album {
    id: ID!
    title: String!
    description: String
    isPublic: Boolean!
    """
    The user who created this album.
    """
    user: User!
    """
    Community this album belongs to, if any.
    """
    communityId: ID
    community: Community
    """
    Optional cover photo for the album.
    """
    coverPhoto: Photo
    """
    Total number of photos in this album.
    """
    photoCount: Int!
    """
    Photos in this album (junction-table based for community albums).
    """
    photos(first: Int = 20, after: String): PhotoConnection!
    """
    Current user's membership in the community this album belongs to (null if not a community album).
    """
    myMembership: CommunityMember
    createdAt: String!
    updatedAt: String!
    """
    Whether this album has been soft-deleted by an admin.
    """
    isDeleted: Boolean!
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
    """
    Album title (required, max 100 characters).
    """
    title: String!
    """
    Optional description.
    """
    description: String
    """
    Whether the album is publicly visible. Defaults to true.
    """
    isPublic: Boolean
  }

  input UpdateAlbumInput {
    """
    New title for the album.
    """
    title: String
    """
    New description.
    """
    description: String
    """
    Toggle album visibility.
    """
    isPublic: Boolean
    """
    Set the cover photo. Must be a photo in this album.
    """
    coverPhotoId: ID
  }

  # ─── Airport & Location Types ────────────────────────────────────────────

  """
  Minimal airport info for typeahead search results.
  """
  type AirportSearchResult {
    icaoCode: String!
    iataCode: String
    name: String!
    city: String
    country: String
    latitude: Float!
    longitude: Float!
  }

  """
  An airport with geographic coordinates and associated photos.
  """
  type Airport {
    id: ID!
    icaoCode: String!
    iataCode: String
    name: String!
    city: String
    country: String
    latitude: Float!
    longitude: Float!
    """
    Number of photos taken at this airport.
    """
    photoCount: Int!
    """
    Spotting locations near this airport.
    """
    spottingLocations: [SpottingLocation!]!
    """
    Whether the authenticated user follows this airport.
    """
    isFollowedByMe: Boolean!
    """
    Number of users following this airport.
    """
    followerCount: Int!
  }

  """
  A known spotting location near an airport.
  """
  type SpottingLocation {
    id: ID!
    name: String!
    description: String
    accessNotes: String
    latitude: Float!
    longitude: Float!
    createdBy: User!
  }

  """
  Location data for a photo, with privacy-filtered coordinates.
  """
  type PhotoLocation {
    id: ID!
    """
    Display latitude (may be jittered based on privacy mode).
    """
    latitude: Float!
    """
    Display longitude (may be jittered based on privacy mode).
    """
    longitude: Float!
    """
    Privacy mode: exact, approximate, or hidden.
    """
    privacyMode: LocationPrivacyMode!
    """
    Location type: airport, museum, cemetery, airfield, other.
    """
    locationType: String
    """
    Country where the photo was taken (resolved from coordinates or airport).
    """
    country: String
    """
    Associated airport, if any.
    """
    airport: Airport
    """
    Associated spotting location, if any.
    """
    spottingLocation: SpottingLocation
  }

  """
  A known aircraft with MSN and manufacturing info.
  """
  type Aircraft {
    id: ID!
    """
    Registration (tail number).
    """
    registration: String!
    """
    Airline or operator.
    """
    airline: String
    """
    Manufacturer serial number.
    """
    msn: String
    """
    Date the aircraft was manufactured.
    """
    manufacturingDate: String
    """
    Aircraft manufacturer.
    """
    manufacturer: AircraftManufacturer
    """
    Aircraft family.
    """
    family: AircraftFamily
    """
    Aircraft variant.
    """
    variant: AircraftVariant
    """
    Operator type (AIRLINE, GENERAL_AVIATION, MILITARY, etc.).
    """
    operatorType: OperatorType
    """
    Linked airline record.
    """
    airlineRef: Airline
    """
    Status: ACTIVE or PENDING_APPROVAL.
    """
    status: AircraftStatus!
    isFollowedByMe: Boolean!
  }

  enum AircraftStatus {
    ACTIVE
    PENDING_APPROVAL
  }

  input CreateAircraftInput {
    registration: String!
    airline: String
    msn: String
    manufacturingDate: String
    manufacturerId: ID
    familyId: ID
    variantId: ID
    operatorType: OperatorType
    airlineId: ID
  }

  input UpdateAircraftInput {
    registration: String
    airline: String
    msn: String
    manufacturingDate: String
    manufacturerId: ID
    familyId: ID
    variantId: ID
    operatorType: OperatorType
    airlineId: ID
  }

  input CreateAirportInput {
    icaoCode: String!
    iataCode: String
    name: String!
    city: String
    country: String
    latitude: Float!
    longitude: Float!
  }

  input UpdateAirportInput {
    icaoCode: String
    iataCode: String
    name: String
    city: String
    country: String
    latitude: Float
    longitude: Float
  }

  """
  Lightweight photo data for map markers.
  """
  type PhotoMapMarker {
    id: ID!
    latitude: Float!
    longitude: Float!
    thumbnailUrl: String
    caption: String
  }

  input CreateSpottingLocationInput {
    """
    Name of the spotting location.
    """
    name: String!
    """
    Description of the location.
    """
    description: String
    """
    Access notes (parking, public transit, etc.).
    """
    accessNotes: String
    """
    Latitude of the spotting location.
    """
    latitude: Float!
    """
    Longitude of the spotting location.
    """
    longitude: Float!
    """
    Airport ID this location is near.
    """
    airportId: ID!
  }

  # ─── Community Types ──────────────────────────────────────────────────────

  """
  A spotting community that users can join and participate in.
  """
  type Community {
    id: ID!
    name: String!
    slug: String!
    description: String
    bannerUrl: String
    avatarUrl: String
    category: String
    visibility: CommunityVisibility!
    inviteCode: String
    location: String
    createdAt: String!
    updatedAt: String!

    """
    The community owner.
    """
    owner: User!

    """
    Total number of members.
    """
    memberCount: Int!

    """
    Current user's membership, if any.
    """
    myMembership: CommunityMember

    """
    Paginated list of community members.
    """
    members(first: Int = 20, after: String): CommunityMemberConnection!

    """
    Recent photos from community members.
    """
    photos(first: Int = 20, after: String): PhotoConnection!

    """
    Community albums. Only present for community-scoped albums.
    """
    albums(first: Int = 20, after: String): AlbumConnection!
  }

  """
  A member of a community with their role and status.
  """
  type CommunityMember {
    id: ID!
    role: CommunityRole!
    status: String!
    joinedAt: String!
    user: User!
    community: Community!
  }

  type CommunityEdge {
    cursor: String!
    node: Community!
  }

  type CommunityConnection {
    edges: [CommunityEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CommunityMemberEdge {
    cursor: String!
    node: CommunityMember!
  }

  type CommunityMemberConnection {
    edges: [CommunityMemberEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  """
  A record of a moderation action taken in a community.
  """
  type CommunityModerationLog {
    id: ID!
    """
    The community where the action was taken.
    """
    community: Community!
    """
    The moderator who performed the action.
    """
    moderator: User!
    """
    The user who was targeted by the action.
    """
    targetUser: User!
    """
    The action taken: ban | unban | kick | pin_thread | unpin_thread | lock_thread | unlock_thread | delete_post
    """
    action: String!
    """
    Optional reason for the action.
    """
    reason: String
    """
    JSON metadata (e.g. threadId for forum actions).
    """
    metadata: JSON
    createdAt: String!
  }

  type CommunityModerationLogEdge {
    cursor: String!
    node: CommunityModerationLog!
  }

  type CommunityModerationLogConnection {
    edges: [CommunityModerationLogEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ─── Site Settings ────────────────────────────────────────────────────────────

  type SiteSettings {
    id: ID!
    bannerUrl: String
    tagline: String
    minPhotoLongEdge: Int!
    maxPhotoLongEdge: Int!
    photoUploadTimeoutSeconds: Int!
    updatedAt: String!
  }

  input UpdateSiteSettingsInput {
    bannerUrl: String
    tagline: String
    minPhotoLongEdge: Int
    maxPhotoLongEdge: Int
    photoUploadTimeoutSeconds: Int
  }

  # ─── Ad Settings ───────────────────────────────────────────────────────────────

  type AdSettings {
    enabled: Boolean!
    adSenseClientId: String!
    slotFeed: String
    slotPhotoDetail: String
    slotSidebar: String
    updatedAt: String!
  }

  input UpdateAdSettingsInput {
    enabled: Boolean
    adSenseClientId: String
    slotFeed: String
    slotPhotoDetail: String
    slotSidebar: String
  }

  input CreateCommunityInput {
    """
    Community name (3–100 characters).
    """
    name: String!
    """
    URL-friendly slug (3–50 characters, lowercase alphanumeric + hyphens).
    """
    slug: String!
    """
    Description of the community.
    """
    description: String
    """
    Community category (e.g. 'military', 'airliners', 'general-aviation').
    """
    category: String
    """
    Visibility: 'public' or 'invite_only'.
    """
    visibility: CommunityVisibility
    """
    Geographic location or region.
    """
    location: String
  }

  input UpdateCommunityInput {
    name: String
    slug: String
    description: String
    category: String
    visibility: CommunityVisibility
    location: String
    bannerUrl: String
    avatarUrl: String
  }

  input CommunityMemberFilter {
    """
    Search by username or display name.
    """
    search: String
    """
    Filter by community role.
    """
    role: [CommunityRole!]
    """
    Filter by membership status (active, banned).
    """
    status: [String!]
    """
    Pagination page size.
    """
    first: Int
    """
    Cursor for pagination.
    """
    after: String
  }

  # ─── Forum Types ─────────────────────────────────────────────────────────

  """
  A discussion category within a community forum or global forum.
  """
  type ForumCategory {
    id: ID!
    communityId: ID
    name: String!
    description: String
    slug: String!
    position: Int!
    createdAt: String!
    updatedAt: String!
    """
    Number of threads in this category.
    """
    threadCount: Int!
    """
    Most recently active thread.
    """
    latestThread: ForumThread
  }

  """
  A discussion thread within a forum category.
  """
  type ForumThread {
    id: ID!
    categoryId: ID!
    title: String!
    isPinned: Boolean!
    isLocked: Boolean!
    postCount: Int!
    createdAt: String!
    updatedAt: String!
    lastPostAt: String!
    author: User!
    category: ForumCategory!
    """
    The opening post of the thread.
    """
    firstPost: ForumPost
    """
    Whether this thread has been soft-deleted by an admin.
    """
    isDeleted: Boolean!
  }

  """
  A post (reply) within a forum thread.
  """
  type ForumPost {
    id: ID!
    threadId: ID!
    parentPostId: ID
    body: String!
    isDeleted: Boolean!
    createdAt: String!
    updatedAt: String!
    author: User!
    """
    Direct replies to this post (max 50).
    """
    replies: [ForumPost!]!
  }

  type ForumThreadEdge {
    cursor: String!
    node: ForumThread!
  }

  type ForumThreadConnection {
    edges: [ForumThreadEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ForumPostEdge {
    cursor: String!
    node: ForumPost!
  }

  type ForumPostConnection {
    edges: [ForumPostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ─── Event Types ─────────────────────────────────────────────────────────

  """
  A community-scoped event with optional RSVP and capacity limit.
  """
  type CommunityEvent {
    id: ID!
    communityId: ID!
    """
    The user who created the event.
    """
    organizer: User!
    title: String!
    description: String
    location: String
    """
    ISO datetime string.
    """
    startsAt: String!
    """
    ISO datetime string, optional end time.
    """
    endsAt: String
    """
    Maximum number of attendees. Null means unlimited.
    """
    maxAttendees: Int
    coverUrl: String
    """
    Number of attendees with status 'going'.
    """
    attendeeCount: Int!
    """
    The current user's RSVP, if any.
    """
    myRsvp: EventAttendee
    """
    Whether the event is at capacity.
    """
    isFull: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  """
  An RSVP record linking a user to an event.
  """
  type EventAttendee {
    id: ID!
    eventId: ID!
    user: User!
    """
    going | maybe | not_going
    """
    status: EventRsvpStatus!
    joinedAt: String!
  }

  type CommunityEventEdge {
    cursor: String!
    node: CommunityEvent!
  }

  type CommunityEventConnection {
    edges: [CommunityEventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateCommunityEventInput {
    title: String!
    description: String
    location: String
    """
    ISO datetime string.
    """
    startsAt: String!
    """
    ISO datetime string, optional.
    """
    endsAt: String
    maxAttendees: Int
    coverUrl: String
  }

  input UpdateCommunityEventInput {
    title: String
    description: String
    location: String
    startsAt: String
    endsAt: String
    maxAttendees: Int
    coverUrl: String
  }

  # ─── Aircraft Hierarchy Inputs ────────────────────────────────────────────

  input CreateManufacturerInput {
    name: String!
    country: String
  }

  input UpdateManufacturerInput {
    name: String
    country: String
  }

  input CreateFamilyInput {
    name: String!
    manufacturerId: ID!
  }

  input UpdateFamilyInput {
    name: String
    manufacturerId: ID
  }

  input CreateVariantInput {
    name: String!
    familyId: ID!
  }

  input UpdateVariantInput {
    name: String
    familyId: ID
  }

  input CreateAirlineInput {
    name: String!
    icaoCode: String
    iataCode: String
    country: String
    callsign: String
  }

  input UpdateAirlineInput {
    name: String
    icaoCode: String
    iataCode: String
    country: String
    callsign: String
  }

  input CreatePhotoCategoryInput {
    name: String!
    label: String!
    sortOrder: Int
  }

  input UpdatePhotoCategoryInput {
    name: String
    label: String
    sortOrder: Int
  }

  input CreateAircraftSpecificCategoryInput {
    name: String!
    label: String!
    sortOrder: Int
  }

  input UpdateAircraftSpecificCategoryInput {
    name: String
    label: String
    sortOrder: Int
  }

  input SubmitListItemInput {
    listType: String!
    value: String!
    metadata: JSON
  }

  # ─── Notifications ───────────────────────────────────────────────────────

  """
  An in-app notification for a user.
  """
  type Notification {
    id: ID!
    """
    Notification type: like | comment | follow | mention | moderation | system | community_join | community_event
    """
    type: NotificationType!
    title: String!
    body: String
    """
    JSON payload with context-specific data (e.g. photoId, communityId).
    """
    data: JSON
    isRead: Boolean!
    createdAt: String!
  }

  type NotificationEdge {
    cursor: String!
    node: Notification!
  }

  type NotificationConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
  }

  # ─── Aircraft Hierarchy Types ──────────────────────────────────────────────

  """
  An aircraft manufacturer (e.g., Boeing, Airbus).
  """
  type AircraftManufacturer {
    id: ID!
    name: String!
    country: String
    families: [AircraftFamily!]!
    createdAt: String!
    isFollowedByMe: Boolean!
  }

  type AircraftFamily {
    id: ID!
    name: String!
    manufacturer: AircraftManufacturer!
    variants: [AircraftVariant!]!
    createdAt: String!
    isFollowedByMe: Boolean!
  }

  type AircraftVariant {
    id: ID!
    name: String!
    family: AircraftFamily!
    iataCode: String
    icaoCode: String
    createdAt: String!
    isFollowedByMe: Boolean!
  }

  type AircraftManufacturerEdge {
    cursor: String!
    node: AircraftManufacturer!
  }

  type AircraftManufacturerConnection {
    edges: [AircraftManufacturerEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AircraftFamilyEdge {
    cursor: String!
    node: AircraftFamily!
  }

  type AircraftFamilyConnection {
    edges: [AircraftFamilyEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AircraftVariantEdge {
    cursor: String!
    node: AircraftVariant!
  }

  type AircraftVariantConnection {
    edges: [AircraftVariantEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ─── Airline ────────────────────────────────────────────────────────────────

  """
  An airline or operator.
  """
  type Airline {
    id: ID!
    name: String!
    icaoCode: String
    iataCode: String
    country: String
    callsign: String
    createdAt: String!
    isFollowedByMe: Boolean!
  }

  type AirlineEdge {
    cursor: String!
    node: Airline!
  }

  type AirlineConnection {
    edges: [AirlineEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ─── Photo Categories ─────────────────────────────────────────────────────

  """
  A photo category for classification (e.g., cabin, cockpit, exterior).
  """
  type PhotoCategory {
    id: ID!
    name: String!
    label: String!
    sortOrder: Int!
    createdAt: String!
  }

  """
  An aircraft-specific category (e.g., vintage, narrowbody, widebody).
  """
  type AircraftSpecificCategory {
    id: ID!
    name: String!
    label: String!
    sortOrder: Int!
    createdAt: String!
  }

  # ─── Pending List Items ────────────────────────────────────────────────────

  """
  A user-submitted item awaiting admin review for addition to a lookup list.
  """
  type PendingListItem {
    id: ID!
    listType: String!
    value: String!
    metadata: JSON
    status: String!
    reviewNote: String
    submitter: User!
    reviewer: User
    createdAt: String!
    updatedAt: String!
  }

  type PendingListItemEdge {
    cursor: String!
    node: PendingListItem!
  }

  type PendingListItemConnection {
    edges: [PendingListItemEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ─── Marketplace Types ────────────────────────────────────────────────────

  """
  A seller profile linked to a Stripe Connect account.
  """
  type SellerProfile {
    id: ID!
    """
    The user who owns this seller account.
    """
    user: User!
    """
    Stripe Connect account ID.
    """
    stripeAccountId: String
    """
    Whether the seller has completed Stripe onboarding.
    """
    stripeOnboardingComplete: Boolean!
    """
    Whether the seller has been approved by an admin.
    """
    approved: Boolean!
    """
    Seller status: pending | approved | rejected.
    """
    status: SellerStatus!
    """
    Seller bio shown on their profile.
    """
    bio: String
    """
    Optional website URL.
    """
    website: String
    """
    Average seller rating (1-5).
    """
    averageRating: Float!
    """
    Total number of feedback ratings received.
    """
    feedbackCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  """
  A photo listing for sale in the marketplace.
  """
  type PhotoListing {
    id: ID!
    """
    The photo being sold.
    """
    photo: Photo!
    """
    Price in USD.
    """
    priceUsd: String!
    """
    Whether the listing is active.
    """
    active: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  """
  A completed or pending purchase of a photo.
  """
  type Order {
    id: ID!
    """
    The user who bought the photo.
    """
    buyer: User!
    """
    The seller who received the payment.
    """
    seller: User!
    """
    The photo that was purchased.
    """
    photo: Photo!
    """
    The listing that was purchased.
    """
    listing: PhotoListing!
    """
    Total amount paid in USD.
    """
    amountUsd: String!
    """
    Platform commission in USD.
    """
    platformFeeUsd: String!
    """
    Stripe Payment Intent ID.
    """
    stripePaymentIntentId: String
    """
    Stripe Transfer ID (for the seller's payout).
    """
    stripeTransferId: String
    """
    Order status: pending | completed | refunded | failed.
    """
    status: OrderStatus!
    createdAt: String!
  }

  type OrderEdge {
    cursor: String!
    node: Order!
  }

  type OrderConnection {
    edges: [OrderEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type MarketplaceListingEdge {
    cursor: String!
    node: Photo!
  }

  type MarketplaceListingConnection {
    edges: [MarketplaceListingEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type SellerProfileEdge {
    cursor: String!
    node: SellerProfile!
  }

  type SellerProfileConnection {
    edges: [SellerProfileEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ApproveSellerPayload {
    sellerProfile: SellerProfile!
    """
    URL to redirect the seller to for Stripe onboarding.
    """
    onboardingUrl: String!
  }

  input ApplyToSellInput {
    """
    Your seller bio shown to buyers.
    """
    bio: String!
    """
    Optional website URL.
    """
    website: String
  }

  input CreateOrUpdateListingInput {
    photoId: ID!
    priceUsd: Decimal!
    active: Boolean!
  }

  type PurchasePayload {
    sessionId: String!
    checkoutUrl: String!
  }

  # ─── Collectibles Marketplace Types ──────────────────────────────────────────

  """
  A collectible item listed for sale in the marketplace.
  """
  type MarketplaceItem {
    id: ID!
    """
    The seller who owns this listing.
    """
    seller: SellerProfile!
    """
    The primary listing category.
    """
    category: MarketplaceCategory!
    title: String!
    description: String
    """
    Price in USD.
    """
    priceUsd: String!
    """
    Condition: mint | excellent | good | fair | poor.
    """
    condition: String!
    """
    General geographic region for shipping.
    """
    location: String
    """
    Seller's contact email (visible after approval).
    """
    contactEmail: String
    """
    Seller's contact phone (visible after approval).
    """
    contactPhone: String
    """
    Whether the item is active and visible to buyers.
    """
    active: Boolean!
    """
    Moderation status: pending | approved | rejected | review.
    """
    moderationStatus: ModerationStatus!
    """
    Reason for rejection, if any.
    """
    moderationReason: String
    images: [MarketplaceItemImage!]!
    """
    Average seller rating (1-5).
    """
    averageRating: Float!
    """
    Total number of feedback ratings received.
    """
    feedbackCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  """
  An image attached to a marketplace item.
  """
  type MarketplaceItemImage {
    id: ID!
    """
    Variant type: thumbnail | display | full_res | watermarked.
    """
    variantType: String!
    url: String!
    width: Int!
    height: Int!
    fileSizeBytes: Int
    sortOrder: Int!
    createdAt: String!
  }

  """
  A category for organizing marketplace items.
  """
  type MarketplaceCategory {
    id: ID!
    """
    URL-safe slug.
    """
    name: String!
    """
    Display name shown to users.
    """
    label: String!
    sortOrder: Int!
    """
    Number of approved items in this category.
    """
    itemCount: Int!
  }

  """
  Feedback from a buyer about a seller after contacting them.
  """
  type SellerFeedback {
    id: ID!
    """
    The seller being rated.
    """
    seller: SellerProfile!
    """
    The buyer who submitted the rating.
    """
    buyer: User!
    """
    Rating from 1 to 5.
    """
    rating: Int!
    """
    Optional comment.
    """
    comment: String
    """
    The item this feedback relates to, if any.
    """
    item: MarketplaceItem
    createdAt: String!
  }

  type MarketplaceItemEdge {
    cursor: String!
    node: MarketplaceItem!
  }

  type MarketplaceItemConnection {
    edges: [MarketplaceItemEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type SellerFeedbackEdge {
    cursor: String!
    node: SellerFeedback!
  }

  type SellerFeedbackConnection {
    edges: [SellerFeedbackEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateMarketplaceItemInput {
    categoryId: ID!
    title: String!
    description: String
    priceUsd: Decimal!
    condition: ItemCondition!
    location: String
    contactEmail: String
    contactPhone: String
    imageS3Keys: [String!]!
  }

  input UpdateMarketplaceItemInput {
    categoryId: ID
    title: String
    description: String
    priceUsd: Decimal
    condition: ItemCondition
    location: String
    contactEmail: String
    contactPhone: String
    imageS3Keys: [String!]
    active: Boolean
  }

  input SubmitSellerFeedbackInput {
    sellerId: ID!
    rating: Int!
    comment: String
    itemId: ID
  }

  input CreateMarketplaceCategoryInput {
    name: String!
    label: String!
    sortOrder: Int
  }

  input UpdateMarketplaceCategoryInput {
    name: String
    label: String
    sortOrder: Int
  }

  # ─── Health ──────────────────────────────────────────────────────────────

  type HealthCheck {
    status: String!
    timestamp: String!
    dbConnected: Boolean!
  }
`;
