# SpotterHub — Architecture Documentation

> Generated from codebase analysis. Last updated: 2026-05-01.

---

## 1. Entity-Relationship Graph

### 1.1 ER Diagram (Mermaid)

```mermaid
erDiagram
  User {
    string id PK
    string cognitoSub UK
    string email UK
    string username UK
    string role "enum: user|moderator|admin|superuser"
    string status "enum: active|suspended|banned"
    boolean emailVerified
    string emailVerificationToken
    string passwordHash
    datetime createdAt
    datetime updatedAt
  }

  Profile {
    string id PK
    string userId FK UK
    string displayName
    string bio
    string avatarUrl
    string locationRegion
    string[] cameraBodies
    string[] lenses
    string experienceLevel
    string gear
    string[] interests
    string[] favoriteAircraft
    string[] favoriteAirports
    boolean isPublic
    datetime createdAt
    datetime updatedAt
  }

  User ||--|| Profile : "1:1"
  User ||--o{ Photo : "owns"
  User ||--o{ Album : "owns"
  User ||--o{ Comment : "writes"
  User ||--o{ Like : "gives"
  User ||--o{ Follow : "follower"
  User ||--o{ Follow : "following"
  User ||--o{ Report : "reporter"
  User ||--o{ Report : "reviewer"
  User ||--o{ Notification : "receives"
  User ||--o{ SpottingLocation : "creates"
  User ||--o{ CommunityMember : "member_of"
  User ||--o{ Community : "owns"
  User ||--o{ ForumThread : "authors"
  User ||--o{ ForumPost : "authors"
  User ||--o{ CommunityEvent : "organizes"
  User ||--o{ EventAttendee : "attends"
  User ||--o{ CommunityModerationLog : "moderator"
  User ||--o{ CommunityModerationLog : "target"
  User ||--o{ Photo : "photographer"
  User ||--o{ PasswordResetToken : "has"
  User ||--o{ PendingListItem : "submits"
  User ||--o{ PendingListItem : "reviews"
  User ||--o{ RefreshToken : "has"
  User ||--o{ SellerProfile : "has_one"
  User ||--o{ Order : "purchases"
  User ||--o{ Order : "sells"
  User ||--o{ PhotoListing : "lists"
  User ||--o{ MarketplaceItem : "sells"
  User ||--o{ SellerFeedback : "receives"
  User ||--o{ Community : "owns"

  RefreshToken {
    string id PK
    string token UK
    string userId FK
    datetime expiresAt
    datetime createdAt
  }

  PasswordResetToken {
    string id PK
    string userId FK
    string token UK
    datetime expiresAt
    datetime usedAt
    datetime createdAt
  }

  Photo {
    string id PK
    string userId FK
    string albumId FK
    string caption
    string airline
    string airportCode
    datetime takenAt
    string originalUrl
    int originalWidth
    int originalHeight
    int fileSizeBytes
    string mimeType
    string moderationStatus "enum: pending|approved|rejected|review"
    json moderationLabels
    float moderationConfidence
    int likeCount
    boolean hasActiveListing
    string license "enum: PhotoLicense"
    boolean watermarkEnabled
    string aircraftId FK
    string photographerId FK
    string photographerName
    string gearBody
    string gearLens
    json exifData
    string photoCategoryId FK
    string aircraftSpecificCategoryId FK
    string operatorIcao
    string operatorType "enum: OperatorType"
    string msn
    string manufacturingDate
    boolean isDeleted
    datetime createdAt
    datetime updatedAt
  }

  Photo ||--o| Album : "belongs_to"
  Photo ||--o{ PhotoVariant : "has"
  Photo ||--o{ PhotoTag : "has"
  Photo ||--o{ PhotoLocation : "has"
  Photo ||--o{ Comment : "has"
  Photo ||--o{ Like : "has"
  Photo ||--o{ PhotoListing : "has_one"
  Photo ||--o{ Order : "purchased_in"
  Photo ||--o| Aircraft : "linked_to"
  Photo ||--o| User : "photographed_by"
  Photo ||--o| PhotoCategory : "categorized"
  Photo ||--o| AircraftSpecificCategory : "categorized"
  Photo ||--o{ AlbumPhoto : "junction"

  PhotoVariant {
    string id PK
    string photoId FK
    string variantType "enum: PhotoVariantType"
    string url
    int width
    int height
    int fileSizeBytes
    datetime createdAt
  }

  PhotoTag {
    string id PK
    string photoId FK
    string tag
    datetime createdAt
  }

  PhotoLocation {
    string id PK
    string photoId FK UK
    float rawLatitude
    float rawLongitude
    float displayLatitude
    float displayLongitude
    string privacyMode "enum: LocationPrivacyMode"
    string airportId FK
    string spottingLocationId FK
    string locationType
    string country
    datetime createdAt
    datetime updatedAt
  }

  PhotoLocation ||--o| Airport : "near"
  PhotoLocation ||--o| SpottingLocation : "near"

  Album {
    string id PK
    string userId FK
    string communityId FK
    string title
    string description
    string coverPhotoId FK
    boolean isPublic
    boolean isDeleted
    datetime createdAt
    datetime updatedAt
  }

  Album ||--o| Community : "community_scoped"
  Album ||--|| Photo : "cover_photo"
  Album ||--o{ Photo : "contains"
  Album ||--o{ AlbumPhoto : "junction"
  Album ||--o{ Comment : "has"
  Album ||--o{ Like : "has"

  AlbumPhoto {
    string albumId FK
    string photoId FK
    datetime addedAt
  }

  AlbumPhoto PK(albumId, photoId)

  Comment {
    string id PK
    string userId FK
    string photoId FK
    string albumId FK
    string parentCommentId FK
    string body
    boolean isDeleted
    datetime createdAt
    datetime updatedAt
  }

  Comment ||--o| Comment : "replies"
  Comment ||--o{ Like : "has"

  Like {
    string id PK
    string userId FK
    string photoId FK
    string albumId FK
    string commentId FK
    datetime createdAt
  }

  Aircraft {
    string id PK
    string registration UK
    string airline
    string msn
    datetime manufacturingDate
    string manufacturerId FK
    string familyId FK
    string variantId FK
    string operatorType "enum: OperatorType"
    string airlineId FK
    string status "enum: active|pending_approval"
    datetime createdAt
    datetime updatedAt
  }

  Aircraft ||--o| AircraftManufacturer : "manufacturer"
  Aircraft ||--o| AircraftFamily : "family"
  Aircraft ||--o| AircraftVariant : "variant"
  Aircraft ||--o| Airline : "operator"
  Aircraft ||--o{ Photo : "photographed"

  AircraftManufacturer {
    string id PK
    string name UK
    string country
    datetime createdAt
  }

  AircraftManufacturer ||--o{ AircraftFamily : "has"

  AircraftFamily {
    string id PK
    string name UK
    string manufacturerId FK
    datetime createdAt
  }

  AircraftFamily ||--o| AircraftManufacturer : "belongs_to"
  AircraftFamily ||--o{ AircraftVariant : "has"

  AircraftVariant {
    string id PK
    string name UK
    string familyId FK
    string iataCode
    string icaoCode
    datetime createdAt
  }

  AircraftVariant ||--o| AircraftFamily : "belongs_to"

  Airline {
    string id PK
    string name
    string icaoCode UK
    string iataCode UK
    string country
    string callsign
    datetime createdAt
  }

  Airline ||--o{ Aircraft : "operates"

  Airport {
    string id PK
    string icaoCode UK
    string iataCode UK
    string name
    string city
    string country
    float latitude
    float longitude
    datetime createdAt
  }

  Airport ||--o{ PhotoLocation : "located_near"
  Airport ||--o{ SpottingLocation : "has"
  Airport ||--o{ Follow : "followed"

  SpottingLocation {
    string id PK
    string airportId FK
    string name
    string description
    string accessNotes
    float latitude
    float longitude
    string createdById FK
    datetime createdAt
    datetime updatedAt
  }

  SpottingLocation ||--o| Airport : "near"
  SpottingLocation ||--o| User : "created_by"
  SpottingLocation ||--o{ PhotoLocation : "used_in"

  Follow {
    string id PK
    string followerId FK
    string targetType "enum: FollowTargetType"
    string followingId FK
    string airportId FK
    string targetValue
    datetime createdAt
  }

  Follow PK(followerId, targetType, followingId)
  Follow PK(followerId, targetType, airportId)
  Follow PK(followerId, targetType, targetValue)

  Report {
    string id PK
    string reporterId FK
    string targetType "enum: ReportTargetType"
    string targetId
    string reason "enum: ReportReason"
    string description
    string status "enum: ReportStatus"
    string reviewedBy FK
    datetime createdAt
    datetime resolvedAt
  }

  Notification {
    string id PK
    string userId FK
    string type "enum: NotificationType"
    string title
    string body
    json data
    boolean isRead
    datetime createdAt
  }

  Community {
    string id PK
    string name
    string slug UK
    string description
    string bannerUrl
    string avatarUrl
    string category
    string visibility "enum: CommunityVisibility"
    string inviteCode UK
    string location
    string ownerId FK
    datetime createdAt
    datetime updatedAt
  }

  Community ||--o| User : "owned_by"
  Community ||--o{ CommunityMember : "has"
  Community ||--o| CommunitySubscription : "subscription"
  Community ||--o{ Album : "has"
  Community ||--o{ ForumCategory : "has"
  Community ||--o{ CommunityEvent : "has"
  Community ||--o{ CommunityModerationLog : "logs"

  CommunityMember {
    string id PK
    string communityId FK
    string userId FK
    string role "enum: CommunityRole"
    string status "enum: CommunityMemberStatus"
    datetime joinedAt
  }

  CommunityMember PK(communityId, userId)

  CommunityMember ||--o| Community : "in"
  CommunityMember ||--o| User : "is"

  CommunitySubscription {
    string id PK
    string communityId FK UK
    string stripeSubId
    string tier "enum: CommunityTier"
    string billingStatus
    datetime createdAt
    datetime updatedAt
  }

  ForumCategory {
    string id PK
    string communityId FK
    string name
    string description
    string slug
    int position
    datetime createdAt
    datetime updatedAt
  }

  ForumCategory UK(communityId, slug)
  ForumCategory ||--o| Community : "belongs_to"
  ForumCategory ||--o{ ForumThread : "has"

  ForumThread {
    string id PK
    string categoryId FK
    string authorId FK
    string title
    boolean isPinned
    boolean isLocked
    int postCount
    datetime createdAt
    datetime updatedAt
    datetime lastPostAt
    boolean isDeleted
  }

  ForumThread ||--o| ForumCategory : "in"
  ForumThread ||--o| User : "author"
  ForumThread ||--o{ ForumPost : "contains"

  ForumPost {
    string id PK
    string threadId FK
    string authorId FK
    string parentPostId FK
    string body
    boolean isDeleted
    datetime createdAt
    datetime updatedAt
  }

  ForumPost ||--o| ForumThread : "in"
  ForumPost ||--o| User : "author"
  ForumPost ||--o| ForumPost : "replies"

  CommunityEvent {
    string id PK
    string communityId FK
    string organizerId FK
    string title
    string description
    string location
    datetime startsAt
    datetime endsAt
    int maxAttendees
    string coverUrl
    datetime createdAt
    datetime updatedAt
  }

  CommunityEvent ||--o| Community : "in"
  CommunityEvent ||--o| User : "organized_by"
  CommunityEvent ||--o{ EventAttendee : "has"

  EventAttendee {
    string id PK
    string eventId FK
    string userId FK
    string status "enum: EventRsvpStatus"
    datetime joinedAt
  }

  EventAttendee PK(eventId, userId)

  EventAttendee ||--o| CommunityEvent : "event"
  EventAttendee ||--o| User : "user"

  CommunityModerationLog {
    string id PK
    string communityId FK
    string moderatorId FK
    string targetUserId FK
    string action "enum: CommunityModerationAction"
    string reason
    json metadata
    datetime createdAt
  }

  CommunityModerationLog ||--o| Community : "in"
  CommunityModerationLog ||--o| User : "moderator"
  CommunityModerationLog ||--o| User : "target"

  PhotoCategory {
    string id PK
    string name UK
    string label
    int sortOrder
    datetime createdAt
  }

  PhotoCategory ||--o{ Photo : "categorizes"

  AircraftSpecificCategory {
    string id PK
    string name UK
    string label
    int sortOrder
    datetime createdAt
  }

  AircraftSpecificCategory ||--o{ Photo : "categorizes"

  PendingListItem {
    string id PK
    string listType
    string value
    json metadata
    string submittedBy FK
    string reviewedBy FK
    string status
    string reviewNote
    datetime createdAt
    datetime updatedAt
  }

  PendingListItem ||--o| User : "submitted_by"
  PendingListItem ||--o| User : "reviewed_by"

  SiteSettings {
    string id PK
    string bannerUrl
    string tagline
    int minPhotoLongEdge
    int maxPhotoLongEdge
    int photoUploadTimeoutSeconds
    datetime updatedAt
  }

  SellerProfile {
    string id PK
    string userId FK UK
    string stripeAccountId UK
    boolean stripeOnboardingComplete
    boolean approved
    string status "enum: SellerStatus"
    string bio
    string website
    datetime createdAt
    datetime updatedAt
  }

  SellerProfile ||--o| User : "user"
  SellerProfile ||--o{ MarketplaceItem : "sells"
  SellerProfile ||--o{ SellerFeedback : "receives"

  PhotoListing {
    string id PK
    string photoId FK UK
    string sellerId FK
    decimal priceUsd
    boolean active
    datetime createdAt
    datetime updatedAt
  }

  PhotoListing ||--o| Photo : "photo"
  PhotoListing ||--o| User : "seller"
  PhotoListing ||--o{ Order : "in"

  Order {
    string id PK
    string buyerId FK
    string sellerId FK
    string photoId FK
    string listingId FK
    decimal amountUsd
    decimal platformFeeUsd
    string stripePaymentIntentId UK
    string stripeTransferId
    string status "enum: OrderStatus"
    datetime createdAt
  }

  Order ||--o| User : "buyer"
  Order ||--o| User : "seller"
  Order ||--o| Photo : "photo"
  Order ||--o| PhotoListing : "listing"

  MarketplaceCategory {
    string id PK
    string name UK
    string label
    int sortOrder
    datetime createdAt
  }

  MarketplaceCategory ||--o{ MarketplaceItem : "categorized"

  MarketplaceItem {
    string id PK
    string sellerId FK
    string userId FK
    string categoryId FK
    string title
    string description
    decimal priceUsd
    string condition
    string location
    string contactEmail
    string contactPhone
    boolean active
    string moderationStatus "enum: ModerationStatus"
    string moderationReason
    datetime createdAt
    datetime updatedAt
  }

  MarketplaceItem ||--o| SellerProfile : "seller"
  MarketplaceItem ||--o| User : "user"
  MarketplaceItem ||--o| MarketplaceCategory : "category"
  MarketplaceItem ||--o{ MarketplaceItemImage : "has"
  MarketplaceItem ||--o{ SellerFeedback : "related_to"

  MarketplaceItemImage {
    string id PK
    string itemId FK
    string variantType "enum: PhotoVariantType"
    string url
    int width
    int height
    int fileSizeBytes
    int sortOrder
    datetime createdAt
  }

  MarketplaceItemImage ||--o| MarketplaceItem : "item"

  SellerFeedback {
    string id PK
    string sellerId FK
    string buyerId FK
    int rating
    string comment
    string itemId FK
    datetime createdAt
  }

  SellerFeedback PK(buyerId, sellerId)
  SellerFeedback ||--o| SellerProfile : "seller"
  SellerFeedback ||--o| User : "buyer"
  SellerFeedback ||--o| MarketplaceItem : "item"
```

---

## 2. Entity Index

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **User** | id, cognitoSub, email, username, role, status, emailVerified, emailVerificationToken, passwordHash | Central identity; roles: user/moderator/admin/superuser |
| **Profile** | id, userId (FK), displayName, bio, avatarUrl, cameraBodies[], lenses[], interests[], isPublic | 1:1 with User |
| **Photo** | id, userId, albumId, caption, airline, airportCode, takenAt, originalUrl, originalWidth/Height, fileSizeBytes, mimeType, moderationStatus, moderationLabels, likeCount, hasActiveListing, license, watermarkEnabled, aircraftId, photographerId, gearBody, gearLens, exifData (JSON), photoCategoryId, aircraftSpecificCategoryId, operatorIcao, operatorType, msn, manufacturingDate, isDeleted | Core content; soft-delete via isDeleted |
| **PhotoVariant** | id, photoId, variantType, url, width, height, fileSizeBytes | thumbnail/thumbnail_16x9/display/full_res/watermarked |
| **PhotoTag** | id, photoId, tag | User-applied tags |
| **PhotoLocation** | id, photoId (unique), rawLatitude/Longitude, displayLatitude/Longitude, privacyMode, airportId, spottingLocationId, locationType, country | Location privacy filtering |
| **Album** | id, userId, communityId, title, description, coverPhotoId, isPublic, isDeleted | Personal or community-scoped |
| **AlbumPhoto** | albumId, photoId, addedAt | Junction for community albums |
| **Comment** | id, userId, photoId, albumId, parentCommentId (self), body, isDeleted | Threaded replies |
| **Like** | id, userId, photoId, albumId, commentId (polymorphic) | Idempotent per entity |
| **Aircraft** | id, registration, airline, msn, manufacturingDate, manufacturerId, familyId, variantId, operatorType, airlineId, status | Linked to photos; status: active/pending_approval |
| **AircraftManufacturer** | id, name, country | Top of aircraft hierarchy |
| **AircraftFamily** | id, name, manufacturerId | Child of manufacturer |
| **AircraftVariant** | id, name, familyId, iataCode, icaoCode | Child of family |
| **Airline** | id, name, icaoCode, iataCode, country, callsign | Linked to Aircraft |
| **Airport** | id, icaoCode, iataCode, name, city, country, latitude, longitude | PostGIS geometry column |
| **SpottingLocation** | id, airportId, name, description, accessNotes, latitude, longitude, createdById | User-contributed POIs |
| **Follow** | id, followerId, targetType, followingId, airportId, targetValue | Polymorphic: user/airport/manufacturer/family/variant/airline/registration |
| **Report** | id, reporterId, targetType, targetId, reason, description, status, reviewedBy, createdAt, resolvedAt | Duplicate prevention |
| **Notification** | id, userId, type, title, body, data (JSON), isRead, createdAt | Types: like/comment/follow/mention/moderation/system/community_join/community_event |
| **Community** | id, name, slug, description, bannerUrl, avatarUrl, category, visibility, inviteCode, location, ownerId | Owner auto-added as CommunityMember |
| **CommunityMember** | id, communityId, userId, role, status, joinedAt | Composite PK (communityId, userId) |
| **CommunitySubscription** | id, communityId, stripeSubId, tier, billingStatus | Stripe Connect for paid communities |
| **ForumCategory** | id, communityId, name, description, slug, position | Unique (communityId, slug); null communityId = global |
| **ForumThread** | id, categoryId, authorId, title, isPinned, isLocked, postCount, createdAt, updatedAt, lastPostAt, isDeleted | Pinned first |
| **ForumPost** | id, threadId, authorId, parentPostId, body, isDeleted, createdAt, updatedAt | Self-referential threaded replies |
| **CommunityEvent** | id, communityId, organizerId, title, description, location, startsAt, endsAt, maxAttendees, coverUrl | Indexed (communityId, startsAt) |
| **EventAttendee** | id, eventId, userId, status, joinedAt | Composite PK (eventId, userId) |
| **CommunityModerationLog** | id, communityId, moderatorId, targetUserId, action, reason, metadata (JSON), createdAt | All moderation actions logged |
| **PhotoCategory** | id, name, label, sortOrder | e.g., cabin, cockpit, exterior |
| **AircraftSpecificCategory** | id, name, label, sortOrder | e.g., vintage, narrowbody, widebody |
| **PendingListItem** | id, listType, value, metadata (JSON), submittedBy, reviewedBy, status, reviewNote, createdAt, updatedAt | Aircraft/community submissions |
| **SiteSettings** | id (singleton), bannerUrl, tagline, minPhotoLongEdge, maxPhotoLongEdge, photoUploadTimeoutSeconds, updatedAt | Singleton row |
| **SellerProfile** | id, userId (UK), stripeAccountId (UK), stripeOnboardingComplete, approved, status, bio, website | Links User to Stripe Connect |
| **PhotoListing** | id, photoId (UK), sellerId, priceUsd, active, createdAt | 1:1 with Photo |
| **Order** | id, buyerId, sellerId, photoId, listingId, amountUsd, platformFeeUsd, stripePaymentIntentId, stripeTransferId, status, createdAt | ~20% platform fee |
| **MarketplaceCategory** | id, name, label, sortOrder | Collectibles marketplace |
| **MarketplaceItem** | id, sellerId, userId, categoryId, title, description, priceUsd, condition, location, contactEmail, contactPhone, active, moderationStatus, moderationReason | Collectibles goods |
| **MarketplaceItemImage** | id, itemId, variantType, url, width, height, fileSizeBytes, sortOrder | Per-item images |
| **SellerFeedback** | id, sellerId, buyerId, rating (1-5), comment, itemId, createdAt | Unique (buyerId, sellerId) |
| **RefreshToken** | id, token (UK), userId, expiresAt, createdAt | Token rotation on sign-in |
| **PasswordResetToken** | id, userId, token (UK), expiresAt, usedAt, createdAt | Single-use, 1-hour expiry |

---

## 3. API Layer — Resolver Index

| Resolver File | Key Operations |
|--------------|----------------|
| `authResolvers.ts` | signUp, signIn, refreshToken, signOut, verifyEmail, requestPasswordReminder, requestPasswordReset, resetPassword |
| `userResolvers.ts` | me, user, users; profile, followerCount, followingCount, photoCount, sellerProfile, canSell |
| `photoResolvers.ts` | photo, photos, getUploadUrl, createPhoto, updatePhoto, deletePhoto, approvePhoto, rejectPhoto, softDeletePhoto, hardDeletePhoto, regeneratePhotoVariants |
| `likeResolvers.ts` | likePhoto, unlikePhoto; isLikedByMe |
| `commentResolvers.ts` | comments, addComment, updateComment, deleteComment, softDeleteComment, hardDeleteComment |
| `albumResolvers.ts` | album, albums, createAlbum, updateAlbum, deleteAlbum, softDeleteAlbum, hardDeleteAlbum, addPhotosToAlbum, removePhotosFromAlbum, createCommunityAlbum, addPhotosToCommunityAlbum, removePhotosFromCommunityAlbum |
| `followResolvers.ts` | followingFeed, myFollowing, followUser, unfollowUser, followAirport, unfollowAirport, followTopic, unfollowTopic; isFollowedByMe |
| `communityResolvers.ts` | community, communities, myCommunities, communityMembers, createCommunity, updateCommunity, deleteCommunity, joinCommunity, leaveCommunity, removeCommunityMember, updateCommunityMemberRole, transferCommunityOwnership, generateInviteCode, deleteCommunityPhoto, deleteCommunityComment, deleteCommunityThread, deleteCommunityPost |
| `forumResolvers.ts` | globalForumCategories, forumCategories, forumCategory, forumThreads, forumThread, forumPosts, createGlobalForumCategory, createForumCategory, updateForumCategory, deleteForumCategory, createForumThread, deleteForumThread, softDeleteForumThread, hardDeleteForumThread, pinForumThread, lockForumThread, createForumPost, updateForumPost, deleteForumPost, hardDeleteForumPost |
| `eventResolvers.ts` | communityEvents, communityEvent, createCommunityEvent, updateCommunityEvent, deleteCommunityEvent, rsvpEvent, cancelRsvp |
| `notificationResolvers.ts` | notifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, deleteNotification |
| `adminResolvers.ts` | adminStats, adminReports, adminUsers, adminPhotos, adminResolveReport, adminUpdateUserStatus, adminUpdateUserRole, adminUpdatePhotoModeration |
| `aircraftHierarchyResolvers.ts` | aircraftManufacturers, aircraftFamilies, aircraftVariants, createManufacturer, updateManufacturer, deleteManufacturer, upsertManufacturer, createFamily, updateFamily, deleteFamily, upsertFamily, createVariant, updateVariant, deleteVariant, upsertVariant |
| `airportResolvers.ts` | airports, airport, adminAirports, exportAirports, searchAirports, createAirport, updateAirport, upsertAirport, deleteAirport |
| `airlineResolvers.ts` | airlines, airline, createAirline, updateAirline, upsertAirport, deleteAirline |
| `categoryResolvers.ts` | photoCategories, aircraftSpecificCategories, createPhotoCategory, updatePhotoCategory, deletePhotoCategory, upsertPhotoCategory, createAircraftSpecificCategory, updateAircraftSpecificCategory, deleteAircraftSpecificCategory, upsertAircraftSpecificCategory |
| `marketplaceResolvers.ts` | marketplaceListings, myPurchases, mySales, adminSellerApplications, applyToSell, approveSeller, createOrUpdateListing, removeListing, createPhotoPurchase |
| `marketplaceCollectiblesResolvers.ts` | marketplaceItems, marketplaceItem, marketplaceCategories, sellerProfile, sellerFeedback, myListings, adminMarketplaceItems, updateSellerStatus, createMarketplaceItem, updateMarketplaceItem, deleteMarketplaceItem, moderateMarketplaceItem, submitSellerFeedback, getMarketplaceItemUploadUrl, createMarketplaceCategory, updateMarketplaceCategory, deleteMarketplaceCategory |
| `pendingListItemResolvers.ts` | pendingListItems, submitListItem, reviewListItem |
| `reportResolvers.ts` | createReport |
| `spottingLocationResolvers.ts` | createSpottingLocation, deleteSpottingLocation |
| `siteSettingsResolvers.ts` | siteSettings, updateSiteSettings |
| `locationResolvers.ts` | photosInBounds, photosNearby (PostGIS spatial queries) |
| `searchResolvers.ts` | searchPhotos, searchUsers, searchAirlines |
| `profileResolvers.ts` | updateProfile, updateAvatar |

---

## 4. Frontend Pages and Data Needs

| Page | Fetches | Key Mutations / Actions |
|------|---------|------------------------|
| `/` (Home) | photos, followingFeed, GET_SITE_SETTINGS | Filter by airport/airline/manufacturer/family/variant/photographer |
| `/upload` | GET_ME, photoCategories, aircraftSpecificCategories, aircraftManufacturers, airlines, SEARCH_AIRCRAFT_REGISTRATIONS, GET_AIRPORT_BY_ICAO | getUploadUrl, createPhoto, createPendingAircraft |
| `/photos/[id]` | GET_PHOTO (photo with all relations) | likePhoto, unlikePhoto, deletePhoto, createPhotoPurchase |
| `/u/[username]/photos` | GET_USER, GET_PHOTOS | Follow/unfollow user |
| `/settings/profile` | GET_ME | updateProfile, updateAvatar |
| `/settings/seller` | sellerProfile, myListings | applyToSell, approveSeller, createOrUpdateListing, removeListing |
| `/settings/purchases` | myPurchases | — |
| `/marketplace` | marketplaceItems, GET_MARKETPLACE_CATEGORIES | Filter/sort |
| `/sell/listings/new` | — | createMarketplaceItem, getMarketplaceItemUploadUrl |
| `/communities/[slug]` | community, members, albums, photos, events | Join/leave |
| `/communities/[slug]/forum/[categorySlug]` | forumThreads, forumCategories | Create thread/post |
| `/following` | myFollowing, followingFeed | Unfollow |
| `/admin` | ADMIN_STATS | — |
| `/admin/settings` | GET_SITE_SETTINGS | updateSiteSettings (superuser only) |
| `/admin/photos`, `/admin/users`, `/admin/reports`, `/admin/aircraft`, `/admin/airlines`, `/admin/airports`, `/admin/manufacturers`, `/admin/families`, `/admin/variants`, `/admin/sellers`, `/admin/marketplace-items`, `/admin/pending-list-items` | Respective admin queries | Per-entity CRUD + moderation |

---

## 5. Authentication & Authorization

### 5.1 Auth Flow (JWT + Refresh Token)

- **Access token**: Short-lived JWT (1 hour), `access_token` HttpOnly cookie
- **Refresh token**: Long-lived opaque token (7 days), `refresh_token` HttpOnly cookie, persisted in DB
- **Token rotation**: `refreshToken` mutation deletes old token, issues new session
- **Sign-out**: deletes refresh token from DB, clears cookies

### 5.2 Roles

| Role | Description |
|------|-------------|
| **user** | Default — upload, create albums, comment, like, follow, report, apply to sell |
| **moderator** | Approve/reject photos, soft-delete content, resolve reports, moderate collectibles, community moderation |
| **admin** | All moderator + manage users, aircraft hierarchy, airports, airlines, categories, site settings, seller applications |
| **superuser** | Bypass all role checks; only superuser can promote to superuser |

### 5.3 Community Roles

| Action | owner | admin | moderator | member |
|--------|-------|-------|-----------|--------|
| Update community | Yes | Yes | No | No |
| Delete community | Yes | No | No | No |
| Remove members | Yes | Yes | Yes | No |
| Ban/unban members | Yes | Yes | Yes | No |
| Pin/lock threads | Yes | Yes | Yes | No |
| Transfer ownership | Yes | No | No | No |

---

## 6. Key Workflows

### 6.1 Photo Upload
```
User drags file → getUploadUrl (presigned S3) → PUT to S3 → createPhoto mutation
→ Server validates dimensions → creates Photo (+ pending status in prod)
→ Async variant generation (thumbnail, display, watermarked)
→ PhotoLocation record (with privacy mode applied)
```

### 6.2 Photo Purchase
```
Buyer clicks "Buy" → createPhotoPurchase → Order (pending) + Stripe Checkout
→ Stripe webhook → Order completed → Stripe transfer to seller (minus ~20% platform fee)
```

### 6.3 Follow System
```
followUser / followAirport / followTopic → creates Follow record
followingFeed → aggregates photos from all followed entities
Notifications sent on new follower
```

### 6.4 Community Albums
```
Owner/admin creates community album via createCommunityAlbum
Members add own photos via addPhotosToCommunityAlbum
Uses AlbumPhoto junction table (not Photo.albumId)
```

### 6.5 Pending Aircraft
```
User types unknown registration → clicks "New" → NewAircraftModal
→ createPendingAircraft → Aircraft (pending_approval)
→ Admin approves in /admin/aircraft → status: active
```

---

## 7. Architecture Notes

### 7.1 Soft Delete Pattern
All soft-deletable entities have `isDeleted: boolean`. A `deletedFilter()` helper returns `{}` for privileged users and `{ isDeleted: false }` for others.

### 7.2 DataLoaders
Batch and cache N+1 queries: `userFollowerCount`, `userFollowingCount`, `userPhotoCount`, `photoLikeCount`, `photoCommentCount`, `photoLocation`, `aircraftById`, `userById`, etc.

### 7.3 Image Variants
After S3 upload, `generateVariants()` creates: `thumbnail` (160px), `thumbnail_16x9` (640px wide), `display` (1920px), `full_res`, `watermarked`.

### 7.4 Location Privacy Modes
- `exact`: raw coordinates stored
- `approximate`: ~0.5km jitter applied
- `hidden`: display coords set to 0; field resolver returns null

### 7.5 Notification System
Fire-and-forget helper (`createNotification()`) used across like, follow, comment mutations. No await — non-blocking.

### 7.6 AWS Infrastructure (as of 2026-05-01)
- **RDS**: `spotterhub-db` (db.t3.medium, 20GB gp3) + `wordmaster-db` (db.t3.micro, stopped)
- **ECS**: `spotterspace-cluster` — 2 Fargate tasks (API: 1vCPU/3GB, Web: 1vCPU/2GB)
- **ALB**: `spotterspace-alb` (public)
- **VPC**: Main VPC (`vpc-09a6870488b73260e`) + unused VPC (`vpc-0a890a99f9551ecb8`)
- **EIP**: 4 total — 1 attached to WordMaster EC2 (now stopped), 3 attached to ALB ENIs
