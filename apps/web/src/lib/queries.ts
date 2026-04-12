import { gql } from 'urql';

// ─── Auth ───────────────────────────────────────────────────────────────────

export const SIGN_UP = gql`
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

export const SIGN_IN = gql`
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

// ─── Photos ─────────────────────────────────────────────────────────────────

export const PHOTO_FIELDS = gql`
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
      profile { displayName avatarUrl }
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

export const GET_PHOTOS = gql`
  query Photos(
    $first: Int
    $after: String
    $userId: ID
    $albumId: ID
    $aircraftType: String
    $airportCode: String
    $tags: [String!]
    $manufacturer: String
    $airline: String
    $photographer: String
    $sortBy: PhotoSortBy
  ) {
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
  ${PHOTO_FIELDS}
`;

export const GET_PHOTO = gql`
  query Photo($id: ID!) {
    photo(id: $id) {
      ...PhotoFields
    }
  }
  ${PHOTO_FIELDS}
`;

export const GET_UPLOAD_URL = gql`
  mutation GetUploadUrl($input: GetUploadUrlInput!) {
    getUploadUrl(input: $input) {
      url
      key
    }
  }
`;

export const CREATE_PHOTO = gql`
  mutation CreatePhoto($input: CreatePhotoInput!) {
    createPhoto(input: $input) {
      ...PhotoFields
    }
  }
  ${PHOTO_FIELDS}
`;

export const LIKE_PHOTO = gql`
  mutation LikePhoto($photoId: ID!) {
    likePhoto(photoId: $photoId) {
      ...PhotoFields
    }
  }
  ${PHOTO_FIELDS}
`;

export const UNLIKE_PHOTO = gql`
  mutation UnlikePhoto($photoId: ID!) {
    unlikePhoto(photoId: $photoId) {
      ...PhotoFields
    }
  }
  ${PHOTO_FIELDS}
`;

// ─── User ───────────────────────────────────────────────────────────────────

export const GET_USER = gql`
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

export const FOLLOW_USER = gql`
  mutation FollowUser($userId: ID!) {
    followUser(userId: $userId) {
      id
      followerCount
      isFollowedByMe
    }
  }
`;

export const UNFOLLOW_USER = gql`
  mutation UnfollowUser($userId: ID!) {
    unfollowUser(userId: $userId) {
      id
      followerCount
      isFollowedByMe
    }
  }
`;

// ─── Comments ───────────────────────────────────────────────────────────────

export const GET_COMMENTS = gql`
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

export const ADD_COMMENT = gql`
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

export const DELETE_COMMENT = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;

// ─── Reports ────────────────────────────────────────────────────────────────

export const CREATE_REPORT = gql`
  mutation CreateReport($input: CreateReportInput!) {
    createReport(input: $input) {
      id
      status
    }
  }
`;

// ─── Me ─────────────────────────────────────────────────────────────────────

export const GET_ME = gql`
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

export const UPDATE_PROFILE = gql`
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

export const UPDATE_AVATAR = gql`
  mutation UpdateAvatar($avatarUrl: String!) {
    updateAvatar(avatarUrl: $avatarUrl) {
      avatarUrl
    }
  }
`;

// ─── Search ─────────────────────────────────────────────────────────────────

export const SEARCH_PHOTOS = gql`
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
  ${PHOTO_FIELDS}
`;

export const SEARCH_USERS = gql`
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

// ─── Airlines ────────────────────────────────────────────────────────────────

export const SEARCH_AIRLINES = gql`
  query SearchAirlines($query: String!, $first: Int) {
    searchAirlines(query: $query, first: $first)
  }
`;

export const SEARCH_AIRPORTS = gql`
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

// ─── Aircraft ────────────────────────────────────────────────────────────────

export const SEARCH_AIRCRAFT_TYPES = gql`
  query SearchAircraftTypes($search: String!, $first: Int) {
    aircraftTypes(search: $search, first: $first) {
      edges {
        cursor
        node {
          id
          iataCode
          icaoCode
          manufacturer
          aircraftName
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

export const GET_AIRPORTS = gql`
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

export const GET_AIRPORT = gql`
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

export const PHOTOS_IN_BOUNDS = gql`
  query PhotosInBounds($swLat: Float!, $swLng: Float!, $neLat: Float!, $neLng: Float!, $first: Int) {
    photosInBounds(swLat: $swLat, swLng: $swLng, neLat: $neLat, neLng: $neLng, first: $first) {
      id
      latitude
      longitude
      thumbnailUrl
      caption
    }
  }
`;

export const PHOTOS_NEARBY = gql`
  query PhotosNearby($latitude: Float!, $longitude: Float!, $radiusMeters: Float, $first: Int) {
    photosNearby(latitude: $latitude, longitude: $longitude, radiusMeters: $radiusMeters, first: $first) {
      id
      latitude
      longitude
      thumbnailUrl
      caption
    }
  }
`;

export const CREATE_SPOTTING_LOCATION = gql`
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

export const DELETE_SPOTTING_LOCATION = gql`
  mutation DeleteSpottingLocation($id: ID!) {
    deleteSpottingLocation(id: $id)
  }
`;

// ─── Albums ─────────────────────────────────────────────────────────────────

export const ALBUM_FIELDS = gql`
  fragment AlbumFields on Album {
    id
    title
    description
    isPublic
    photoCount
    createdAt
    updatedAt
    communityId
    community { id name slug }
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

export const GET_ALBUM = gql`
  query Album($id: ID!) {
    album(id: $id) {
      ...AlbumFields
      myMembership { id role status }
    }
  }
  ${ALBUM_FIELDS}
`;

export const GET_ALBUMS = gql`
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
  ${ALBUM_FIELDS}
`;

export const CREATE_ALBUM = gql`
  mutation CreateAlbum($input: CreateAlbumInput!) {
    createAlbum(input: $input) {
      ...AlbumFields
    }
  }
  ${ALBUM_FIELDS}
`;

export const UPDATE_ALBUM = gql`
  mutation UpdateAlbum($id: ID!, $input: UpdateAlbumInput!) {
    updateAlbum(id: $id, input: $input) {
      ...AlbumFields
    }
  }
  ${ALBUM_FIELDS}
`;

export const DELETE_ALBUM = gql`
  mutation DeleteAlbum($id: ID!) {
    deleteAlbum(id: $id)
  }
`;

export const ADD_PHOTOS_TO_ALBUM = gql`
  mutation AddPhotosToAlbum($albumId: ID!, $photoIds: [ID!]!) {
    addPhotosToAlbum(albumId: $albumId, photoIds: $photoIds) {
      ...AlbumFields
    }
  }
  ${ALBUM_FIELDS}
`;

export const REMOVE_PHOTOS_FROM_ALBUM = gql`
  mutation RemovePhotosFromAlbum($albumId: ID!, $photoIds: [ID!]!) {
    removePhotosFromAlbum(albumId: $albumId, photoIds: $photoIds) {
      ...AlbumFields
    }
  }
  ${ALBUM_FIELDS}
`;

export const CREATE_COMMUNITY_ALBUM = gql`
  mutation CreateCommunityAlbum($communityId: ID!, $input: CreateAlbumInput!) {
    createCommunityAlbum(communityId: $communityId, input: $input) {
      ...AlbumFields
      community { id name slug }
    }
  }
  ${ALBUM_FIELDS}
`;

export const ADD_PHOTOS_TO_COMMUNITY_ALBUM = gql`
  mutation AddPhotosToCommunityAlbum($albumId: ID!, $photoIds: [ID!]!) {
    addPhotosToCommunityAlbum(albumId: $albumId, photoIds: $photoIds) {
      ...AlbumFields
    }
  }
  ${ALBUM_FIELDS}
`;

export const REMOVE_PHOTOS_FROM_COMMUNITY_ALBUM = gql`
  mutation RemovePhotosFromCommunityAlbum($albumId: ID!, $photoIds: [ID!]!) {
    removePhotosFromCommunityAlbum(albumId: $albumId, photoIds: $photoIds) {
      ...AlbumFields
    }
  }
  ${ALBUM_FIELDS}
`;

// ─── Follow (Airport / Topic) ───────────────────────────────────────────────

export const FOLLOW_AIRPORT = gql`
  mutation FollowAirport($airportId: ID!) {
    followAirport(airportId: $airportId) {
      id
      isFollowedByMe
      followerCount
    }
  }
`;

export const UNFOLLOW_AIRPORT = gql`
  mutation UnfollowAirport($airportId: ID!) {
    unfollowAirport(airportId: $airportId) {
      id
      isFollowedByMe
      followerCount
    }
  }
`;

export const FOLLOW_TOPIC = gql`
  mutation FollowTopic($targetType: String!, $value: String!) {
    followTopic(targetType: $targetType, value: $value) {
      targetType
      value
    }
  }
`;

export const UNFOLLOW_TOPIC = gql`
  mutation UnfollowTopic($targetType: String!, $value: String!) {
    unfollowTopic(targetType: $targetType, value: $value) {
      targetType
      value
    }
  }
`;

// ─── My Following ───────────────────────────────────────────────────────────

export const GET_MY_FOLLOWING = gql`
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

// ─── Following Feed ─────────────────────────────────────────────────────────

export const GET_FOLLOWING_FEED = gql`
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
  ${PHOTO_FIELDS}
`;

// ─── Admin ──────────────────────────────────────────────────────────────────

export const ADMIN_STATS = gql`
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

export const ADMIN_REPORTS = gql`
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
          reporter { id username }
          reviewer { id username }
          createdAt
          resolvedAt
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const ADMIN_USERS = gql`
  query AdminUsers($role: String, $status: String, $search: String, $first: Int, $after: String) {
    adminUsers(role: $role, status: $status, search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          username
          email
          role
          status
          createdAt
          profile { displayName avatarUrl }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const ADMIN_PHOTOS = gql`
  query AdminPhotos($moderationStatus: String, $first: Int, $after: String) {
    adminPhotos(moderationStatus: $moderationStatus, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...PhotoFields
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
  ${PHOTO_FIELDS}
`;

export const ADMIN_RESOLVE_REPORT = gql`
  mutation AdminResolveReport($id: ID!, $action: String!) {
    adminResolveReport(id: $id, action: $action) {
      id
      status
      resolvedAt
    }
  }
`;

export const ADMIN_UPDATE_USER_STATUS = gql`
  mutation AdminUpdateUserStatus($userId: ID!, $status: String!) {
    adminUpdateUserStatus(userId: $userId, status: $status) {
      id
      status
    }
  }
`;

export const ADMIN_UPDATE_USER_ROLE = gql`
  mutation AdminUpdateUserRole($userId: ID!, $role: String!) {
    adminUpdateUserRole(userId: $userId, role: $role) {
      id
      role
    }
  }
`;

export const ADMIN_UPDATE_PHOTO_MODERATION = gql`
  mutation AdminUpdatePhotoModeration($photoId: ID!, $status: String!) {
    adminUpdatePhotoModeration(photoId: $photoId, status: $status) {
      id
      moderationStatus
    }
  }
`;

// ─── Communities ─────────────────────────────────────────────────────────

export const GET_COMMUNITY = gql`
  query Community($slug: String!) {
    community(slug: $slug) {
      id name slug description bannerUrl avatarUrl category visibility location
      inviteCode
      createdAt
      owner { id username profile { displayName avatarUrl } }
      memberCount
      myMembership { id role status }
      members(first: 20) {
        edges { node { id role status joinedAt user { id username profile { displayName avatarUrl } } } }
        totalCount
        pageInfo { hasNextPage endCursor }
      }
      photos(first: 12) {
        edges {
          cursor
          node { ...PhotoFields }
        }
        pageInfo { hasNextPage endCursor }
        totalCount
      }
      albums(first: 20) {
        edges { node { ...AlbumFields } }
        totalCount
        pageInfo { hasNextPage endCursor }
      }
    }
  }
  ${ALBUM_FIELDS}
  ${PHOTO_FIELDS}
`;

export const GET_COMMUNITIES = gql`
  query Communities($search: String, $category: String, $first: Int, $after: String) {
    communities(search: $search, category: $category, first: $first, after: $after) {
      edges {
        cursor
        node {
          id name slug description category avatarUrl location
          memberCount
          owner { username }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const MY_COMMUNITIES = gql`
  query MyCommunities { myCommunities { id name slug avatarUrl memberCount } }
`;

export const CREATE_COMMUNITY = gql`
  mutation CreateCommunity($input: CreateCommunityInput!) {
    createCommunity(input: $input) { id slug }
  }
`;

export const JOIN_COMMUNITY = gql`
  mutation JoinCommunity($communityId: ID!, $inviteCode: String) {
    joinCommunity(communityId: $communityId, inviteCode: $inviteCode) { id role }
  }
`;

export const LEAVE_COMMUNITY = gql`
  mutation LeaveCommunity($communityId: ID!) { leaveCommunity(communityId: $communityId) }
`;

export const UPDATE_COMMUNITY = gql`
  mutation UpdateCommunity($id: ID!, $input: UpdateCommunityInput!) {
    updateCommunity(id: $id, input: $input) {
      id name slug description category visibility location
    }
  }
`;

export const DELETE_COMMUNITY = gql`
  mutation DeleteCommunity($id: ID!) { deleteCommunity(id: $id) }
`;

export const GENERATE_INVITE_CODE = gql`
  mutation GenerateInviteCode($communityId: ID!) {
    generateInviteCode(communityId: $communityId) { id inviteCode }
  }
`;

export const BAN_COMMUNITY_MEMBER = gql`
  mutation BanCommunityMember($communityId: ID!, $userId: ID!, $reason: String) {
    banCommunityMember(communityId: $communityId, userId: $userId, reason: $reason) {
      id
      status
      role
    }
  }
`;

export const UNBAN_COMMUNITY_MEMBER = gql`
  mutation UnbanCommunityMember($communityId: ID!, $userId: ID!) {
    unbanCommunityMember(communityId: $communityId, userId: $userId) {
      id
      status
      role
    }
  }
`;

export const REMOVE_COMMUNITY_MEMBER = gql`
  mutation RemoveCommunityMember($communityId: ID!, $userId: ID!) {
    removeCommunityMember(communityId: $communityId, userId: $userId)
  }
`;

export const GET_COMMUNITY_MODERATION_LOGS = gql`
  query CommunityModerationLogs($communityId: ID!, $action: String, $first: Int, $after: String) {
    communityModerationLogs(communityId: $communityId, action: $action, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          action
          reason
          metadata
          createdAt
          moderator { id username profile { displayName avatarUrl } }
          targetUser { id username profile { displayName avatarUrl } }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

// ─── Forum ───────────────────────────────────────────────────────────────────

export const GET_FORUM_CATEGORIES = gql`
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
        author { username }
      }
    }
  }
`;

export const GET_FORUM_THREADS = gql`
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
          author { username profile { displayName avatarUrl } }
          firstPost { body }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const GET_FORUM_THREAD = gql`
  query ForumThread($id: ID!) {
    forumThread(id: $id) {
      id
      title
      isPinned
      isLocked
      postCount
      lastPostAt
      createdAt
      author { username profile { displayName avatarUrl } }
      category { id name slug communityId }
    }
  }
`;

export const GET_FORUM_POSTS = gql`
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
          author { username profile { displayName avatarUrl } }
          replies {
            id
            body
            isDeleted
            createdAt
            author { username profile { displayName avatarUrl } }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const CREATE_FORUM_CATEGORY = gql`
  mutation CreateForumCategory($communityId: ID, $name: String!, $description: String, $slug: String) {
    createForumCategory(communityId: $communityId, name: $name, description: $description, slug: $slug) {
      id name slug description position threadCount
    }
  }
`;

export const UPDATE_FORUM_CATEGORY = gql`
  mutation UpdateForumCategory($id: ID!, $name: String, $description: String, $position: Int) {
    updateForumCategory(id: $id, name: $name, description: $description, position: $position) {
      id name description position
    }
  }
`;

export const DELETE_FORUM_CATEGORY = gql`
  mutation DeleteForumCategory($id: ID!) { deleteForumCategory(id: $id) }
`;

export const CREATE_FORUM_THREAD = gql`
  mutation CreateForumThread($categoryId: ID!, $title: String!, $body: String!) {
    createForumThread(categoryId: $categoryId, title: $title, body: $body) {
      id title isPinned isLocked postCount createdAt
      author { username }
    }
  }
`;

export const DELETE_FORUM_THREAD = gql`
  mutation DeleteForumThread($id: ID!) { deleteForumThread(id: $id) }
`;

export const PIN_FORUM_THREAD = gql`
  mutation PinForumThread($id: ID!, $pinned: Boolean!) {
    pinForumThread(id: $id, pinned: $pinned) { id isPinned }
  }
`;

export const LOCK_FORUM_THREAD = gql`
  mutation LockForumThread($id: ID!, $locked: Boolean!) {
    lockForumThread(id: $id, locked: $locked) { id isLocked }
  }
`;

export const CREATE_FORUM_POST = gql`
  mutation CreateForumPost($threadId: ID!, $body: String!, $parentPostId: ID) {
    createForumPost(threadId: $threadId, body: $body, parentPostId: $parentPostId) {
      id body isDeleted createdAt
      author { username profile { displayName avatarUrl } }
      replies { id body isDeleted createdAt author { username profile { displayName avatarUrl } } }
    }
  }
`;

export const UPDATE_FORUM_POST = gql`
  mutation UpdateForumPost($id: ID!, $body: String!) {
    updateForumPost(id: $id, body: $body) { id body }
  }
`;

export const GET_GLOBAL_FORUM_CATEGORIES = gql`
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
        author { username }
      }
    }
  }
`;

export const CREATE_GLOBAL_FORUM_CATEGORY = gql`
  mutation CreateGlobalForumCategory($name: String!, $description: String, $slug: String) {
    createGlobalForumCategory(name: $name, description: $description, slug: $slug) {
      id name slug description position threadCount
    }
  }
`;

export const DELETE_FORUM_POST = gql`
  mutation DeleteForumPost($id: ID!) { deleteForumPost(id: $id) }
`;

// ─── Events ──────────────────────────────────────────────────────────────────

export const GET_COMMUNITY_EVENTS = gql`
  query GetCommunityEvents($communityId: ID!, $first: Int, $after: String, $includePast: Boolean) {
    communityEvents(communityId: $communityId, first: $first, after: $after, includePast: $includePast) {
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
          myRsvp { id status }
          organizer {
            id
            username
            profile { displayName avatarUrl }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const GET_COMMUNITY_EVENT = gql`
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
      myRsvp { id status }
      organizer {
        id
        username
        profile { displayName avatarUrl }
      }
    }
  }
`;

export const CREATE_COMMUNITY_EVENT = gql`
  mutation CreateCommunityEvent($communityId: ID!, $input: CreateCommunityEventInput!) {
    createCommunityEvent(communityId: $communityId, input: $input) {
      id title startsAt endsAt
    }
  }
`;

export const UPDATE_COMMUNITY_EVENT = gql`
  mutation UpdateCommunityEvent($id: ID!, $input: UpdateCommunityEventInput!) {
    updateCommunityEvent(id: $id, input: $input) {
      id title description location startsAt endsAt maxAttendees
    }
  }
`;

export const DELETE_COMMUNITY_EVENT = gql`
  mutation DeleteCommunityEvent($id: ID!) { deleteCommunityEvent(id: $id) }
`;

export const RSVP_EVENT = gql`
  mutation RsvpEvent($eventId: ID!, $status: String!) {
    rsvpEvent(eventId: $eventId, status: $status) { id status joinedAt }
  }
`;

export const CANCEL_RSVP = gql`
  mutation CancelRsvp($eventId: ID!) { cancelRsvp(eventId: $eventId) }
`;

// ─── Notifications ────────────────────────────────────────────────────────────

export const GET_NOTIFICATIONS = gql`
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

export const GET_UNREAD_COUNT = gql`
  query GetUnreadCount {
    unreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      isRead
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($id: ID!) {
    deleteNotification(id: $id)
  }
`;

// ─── Site Settings ────────────────────────────────────────────────────────────

export const GET_SITE_SETTINGS = gql`
  query SiteSettings {
    siteSettings {
      id
      bannerUrl
      tagline
      updatedAt
    }
  }
`;

export const UPDATE_SITE_SETTINGS = gql`
  mutation UpdateSiteSettings($input: UpdateSiteSettingsInput!) {
    updateSiteSettings(input: $input) {
      id
      bannerUrl
      tagline
      updatedAt
    }
  }
`;
