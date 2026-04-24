import { gql } from 'urql';

// ─── Auth ───────────────────────────────────────────────────────────────────

export const SIGN_UP = gql`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      user {
        id
        email
        username
        role
      }
    }
  }
`;

export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
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

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
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

// ─── Photos ─────────────────────────────────────────────────────────────────

export const PHOTO_FIELDS = gql`
  fragment PhotoFields on Photo {
    id
    caption
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
    photoCategory {
      id
      name
      label
    }
    aircraftSpecificCategory {
      id
      name
      label
    }
    operatorIcao
    operatorType
    msn
    manufacturingDate
    aircraft {
      id
      registration
      airline
      msn
      manufacturingDate
      manufacturer {
        id
        name
      }
      family {
        id
        name
      }
      variant {
        id
        name
        iataCode
        icaoCode
      }
      operatorType
      airlineRef {
        id
        name
        icaoCode
        iataCode
        isFollowedByMe
      }
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
      locationType
      country
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
    exifData
    similarAircraftPhotos(first: 12) {
      totalCount
      edges {
        cursor
        node {
          id
          caption
          airportCode
          takenAt
          originalUrl
          originalWidth
          originalHeight
          variants {
            id
            variantType
            url
            width
            height
          }
          aircraft {
            id
            registration
            manufacturer {
              id
              name
            }
            family {
              id
              name
            }
            variant {
              id
              name
              iataCode
              icaoCode
            }
          }
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
      pageInfo {
        hasNextPage
        endCursor
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
    $airportCode: String
    $tags: [String!]
    $manufacturer: String
    $family: String
    $variant: String
    $airline: String
    $photographer: String
    $sortBy: PhotoSortBy
  ) {
    photos(
      first: $first
      after: $after
      userId: $userId
      albumId: $albumId
      airportCode: $airportCode
      tags: $tags
      manufacturer: $manufacturer
      family: $family
      variant: $variant
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

export const DELETE_PHOTO = gql`
  mutation DeletePhoto($photoId: ID!) {
    deletePhoto(id: $photoId)
  }
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
      latitude
      longitude
    }
  }
`;

// ─── Aircraft ────────────────────────────────────────────────────────────────

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
  query PhotosInBounds(
    $swLat: Float!
    $swLng: Float!
    $neLat: Float!
    $neLng: Float!
    $first: Int
  ) {
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

export const GET_ALBUM = gql`
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
      community {
        id
        name
        slug
      }
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

export const ADMIN_PHOTOS = gql`
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
  ${PHOTO_FIELDS}
`;

// ─── Admin Reference Data ────────────────────────────────────────────────────

export const ADMIN_AIRPORTS = gql`
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

export const EXPORT_AIRPORTS = gql`
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

export const CREATE_AIRPORT = gql`
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

export const UPDATE_AIRPORT = gql`
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

export const UPSERT_AIRPORT = gql`
  mutation UpsertAirport($input: CreateAirportInput!) {
    upsertAirport(input: $input) {
      id
    }
  }
`;

export const DELETE_AIRPORT = gql`
  mutation DeleteAirport($id: ID!) {
    deleteAirport(id: $id)
  }
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

export const APPROVE_PHOTO = gql`
  mutation ApprovePhoto($photoId: ID!) {
    approvePhoto(photoId: $photoId) {
      id
      moderationStatus
    }
  }
`;

export const REJECT_PHOTO = gql`
  mutation RejectPhoto($photoId: ID!, $reason: String) {
    rejectPhoto(photoId: $photoId, reason: $reason) {
      id
      moderationStatus
    }
  }
`;

// ─── Communities ─────────────────────────────────────────────────────────

export const GET_COMMUNITY = gql`
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
  ${ALBUM_FIELDS}
  ${PHOTO_FIELDS}
`;

export const GET_COMMUNITIES = gql`
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

export const MY_COMMUNITIES = gql`
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

export const CREATE_COMMUNITY = gql`
  mutation CreateCommunity($input: CreateCommunityInput!) {
    createCommunity(input: $input) {
      id
      slug
    }
  }
`;

export const JOIN_COMMUNITY = gql`
  mutation JoinCommunity($communityId: ID!, $inviteCode: String) {
    joinCommunity(communityId: $communityId, inviteCode: $inviteCode) {
      id
      role
    }
  }
`;

export const LEAVE_COMMUNITY = gql`
  mutation LeaveCommunity($communityId: ID!) {
    leaveCommunity(communityId: $communityId)
  }
`;

export const UPDATE_COMMUNITY = gql`
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

export const DELETE_COMMUNITY = gql`
  mutation DeleteCommunity($id: ID!) {
    deleteCommunity(id: $id)
  }
`;

export const GENERATE_INVITE_CODE = gql`
  mutation GenerateInviteCode($communityId: ID!) {
    generateInviteCode(communityId: $communityId) {
      id
      inviteCode
    }
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

export const UPDATE_COMMUNITY_MEMBER_ROLE = gql`
  mutation UpdateCommunityMemberRole($communityId: ID!, $userId: ID!, $role: String!) {
    updateCommunityMemberRole(communityId: $communityId, userId: $userId, role: $role) {
      id
      role
      status
    }
  }
`;

export const TRANSFER_COMMUNITY_OWNERSHIP = gql`
  mutation TransferCommunityOwnership($communityId: ID!, $userId: ID!) {
    transferCommunityOwnership(communityId: $communityId, userId: $userId) {
      id
      owner {
        id
        username
      }
    }
  }
`;

export const GET_COMMUNITY_MEMBERS = gql`
  query GetCommunityMembers($communityId: ID!, $filter: CommunityMemberFilter) {
    communityMembers(communityId: $communityId, filter: $filter) {
      totalCount
      edges {
        cursor
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
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const DELETE_COMMUNITY_PHOTO = gql`
  mutation DeleteCommunityPhoto($communityId: ID!, $photoId: ID!, $reason: String) {
    deleteCommunityPhoto(communityId: $communityId, photoId: $photoId, reason: $reason)
  }
`;

export const DELETE_COMMUNITY_COMMENT = gql`
  mutation DeleteCommunityComment($communityId: ID!, $commentId: ID!, $reason: String) {
    deleteCommunityComment(communityId: $communityId, commentId: $commentId, reason: $reason)
  }
`;

export const DELETE_COMMUNITY_THREAD = gql`
  mutation DeleteCommunityThread($communityId: ID!, $threadId: ID!, $reason: String) {
    deleteCommunityThread(communityId: $communityId, threadId: $threadId, reason: $reason)
  }
`;

export const DELETE_COMMUNITY_POST = gql`
  mutation DeleteCommunityPost($communityId: ID!, $postId: ID!, $reason: String) {
    deleteCommunityPost(communityId: $communityId, postId: $postId, reason: $reason)
  }
`;

export const GET_COMMUNITY_MODERATION_LOGS = gql`
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
        author {
          username
        }
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

export const CREATE_FORUM_CATEGORY = gql`
  mutation CreateForumCategory(
    $communityId: ID
    $name: String!
    $description: String
    $slug: String
  ) {
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

export const UPDATE_FORUM_CATEGORY = gql`
  mutation UpdateForumCategory($id: ID!, $name: String, $description: String, $position: Int) {
    updateForumCategory(id: $id, name: $name, description: $description, position: $position) {
      id
      name
      description
      position
    }
  }
`;

export const DELETE_FORUM_CATEGORY = gql`
  mutation DeleteForumCategory($id: ID!) {
    deleteForumCategory(id: $id)
  }
`;

export const CREATE_FORUM_THREAD = gql`
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

export const DELETE_FORUM_THREAD = gql`
  mutation DeleteForumThread($id: ID!) {
    deleteForumThread(id: $id)
  }
`;

export const PIN_FORUM_THREAD = gql`
  mutation PinForumThread($id: ID!, $pinned: Boolean!) {
    pinForumThread(id: $id, pinned: $pinned) {
      id
      isPinned
    }
  }
`;

export const LOCK_FORUM_THREAD = gql`
  mutation LockForumThread($id: ID!, $locked: Boolean!) {
    lockForumThread(id: $id, locked: $locked) {
      id
      isLocked
    }
  }
`;

export const CREATE_FORUM_POST = gql`
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

export const UPDATE_FORUM_POST = gql`
  mutation UpdateForumPost($id: ID!, $body: String!) {
    updateForumPost(id: $id, body: $body) {
      id
      body
    }
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
        author {
          username
        }
      }
    }
  }
`;

export const CREATE_GLOBAL_FORUM_CATEGORY = gql`
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

export const DELETE_FORUM_POST = gql`
  mutation DeleteForumPost($id: ID!) {
    deleteForumPost(id: $id)
  }
`;

// ─── Events ──────────────────────────────────────────────────────────────────

export const GET_COMMUNITY_EVENTS = gql`
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

export const CREATE_COMMUNITY_EVENT = gql`
  mutation CreateCommunityEvent($communityId: ID!, $input: CreateCommunityEventInput!) {
    createCommunityEvent(communityId: $communityId, input: $input) {
      id
      title
      startsAt
      endsAt
    }
  }
`;

export const UPDATE_COMMUNITY_EVENT = gql`
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

export const DELETE_COMMUNITY_EVENT = gql`
  mutation DeleteCommunityEvent($id: ID!) {
    deleteCommunityEvent(id: $id)
  }
`;

export const RSVP_EVENT = gql`
  mutation RsvpEvent($eventId: ID!, $status: String!) {
    rsvpEvent(eventId: $eventId, status: $status) {
      id
      status
      joinedAt
    }
  }
`;

export const CANCEL_RSVP = gql`
  mutation CancelRsvp($eventId: ID!) {
    cancelRsvp(eventId: $eventId)
  }
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

// ─── Categories ───────────────────────────────────────────────────────────────

export const GET_PHOTO_CATEGORIES = gql`
  query PhotoCategories {
    photoCategories {
      id
      name
      label
      sortOrder
    }
  }
`;

export const GET_AIRCRAFT_SPECIFIC_CATEGORIES = gql`
  query AircraftSpecificCategories {
    aircraftSpecificCategories {
      id
      name
      label
      sortOrder
    }
  }
`;

// ─── Aircraft Hierarchy ────────────────────────────────────────────────────────

export const SEARCH_AIRCRAFT_REGISTRATIONS = gql`
  query SearchAircraftRegistrations($search: String!, $first: Int) {
    aircraftSearch(search: $search, first: $first) {
      edges {
        node {
          id
          registration
          manufacturer {
            id
            name
          }
          family {
            id
            name
          }
          variant {
            id
            name
            iataCode
            icaoCode
          }
          airlineRef {
            id
            name
            icaoCode
            iataCode
            country
          }
          msn
          manufacturingDate
          operatorType
        }
      }
    }
  }
`;

export const GET_AIRCRAFT_MANUFACTURERS = gql`
  query AircraftManufacturers($search: String, $first: Int) {
    aircraftManufacturers(search: $search, first: $first) {
      edges {
        node {
          id
          name
          country
          isFollowedByMe
        }
      }
    }
  }
`;

export const GET_AIRCRAFT_FAMILIES = gql`
  query AircraftFamilies($manufacturerId: ID, $search: String, $first: Int) {
    aircraftFamilies(manufacturerId: $manufacturerId, search: $search, first: $first) {
      edges {
        node {
          id
          name
          isFollowedByMe
          manufacturer {
            id
            name
          }
        }
      }
    }
  }
`;

export const GET_AIRCRAFT_VARIANTS = gql`
  query AircraftVariants($familyId: ID, $search: String, $first: Int) {
    aircraftVariants(familyId: $familyId, search: $search, first: $first) {
      edges {
        node {
          id
          name
          iataCode
          icaoCode
          isFollowedByMe
          family {
            id
            name
          }
        }
      }
    }
  }
`;

export const GET_AIRLINES = gql`
  query AircraftAirlines($search: String, $first: Int) {
    airlines(search: $search, first: $first) {
      edges {
        node {
          id
          name
          icaoCode
          iataCode
          country
          isFollowedByMe
        }
      }
    }
  }
`;

export const GET_AIRCRAFT_BY_REGISTRATION = gql`
  query AircraftByRegistration($registration: String!) {
    aircraft(registration: $registration) {
      id
      registration
      manufacturer {
        id
        name
      }
      family {
        id
        name
      }
      variant {
        id
        name
        iataCode
        icaoCode
      }
      airlineRef {
        id
        name
        icaoCode
        iataCode
        country
        callsign
      }
      msn
      manufacturingDate
      operatorType
    }
  }
`;

export const ADMIN_AIRCRAFT = gql`
  query AdminAircraft($search: String, $first: Int, $after: String) {
    adminAircraft(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          registration
          msn
          manufacturingDate
          operatorType
          manufacturer {
            id
            name
          }
          family {
            id
            name
          }
          variant {
            id
            name
            iataCode
            icaoCode
          }
          airlineRef {
            id
            name
            icaoCode
            iataCode
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

export const CREATE_AIRCRAFT = gql`
  mutation CreateAircraft($input: CreateAircraftInput!) {
    createAircraft(input: $input) {
      id
    }
  }
`;

export const UPDATE_AIRCRAFT = gql`
  mutation UpdateAircraft($id: ID!, $input: UpdateAircraftInput!) {
    updateAircraft(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_AIRCRAFT = gql`
  mutation DeleteAircraft($id: ID!) {
    deleteAircraft(id: $id)
  }
`;

export const UPSERT_AIRCRAFT = gql`
  mutation UpsertAircraft($input: CreateAircraftInput!) {
    upsertAircraft(input: $input) {
      id
    }
  }
`;

export const EXPORT_AIRCRAFT = gql`
  query ExportAircraft {
    adminAircraft(first: 10000) {
      edges {
        node {
          id
          registration
          msn
          manufacturingDate
          operatorType
          manufacturer {
            id
            name
          }
          family {
            id
            name
          }
          variant {
            id
            name
            iataCode
            icaoCode
          }
          airlineRef {
            id
            name
            icaoCode
            iataCode
          }
        }
      }
    }
  }
`;

// ─── Airlines ─────────────────────────────────────────────────────────────────

export const SEARCH_AIRLINES_BY_ICAO = gql`
  query SearchAirlinesByIcao($icaoCode: String!) {
    airline(icaoCode: $icaoCode) {
      id
      name
      icaoCode
      iataCode
      country
      callsign
    }
  }
`;

export const SEARCH_AIRLINES_PAGINATED = gql`
  query SearchAirlinesPaginated($search: String!, $first: Int) {
    airlines(search: $search, first: $first) {
      edges {
        node {
          id
          name
          icaoCode
          iataCode
          country
          callsign
        }
      }
    }
  }
`;

// ─── Airports ─────────────────────────────────────────────────────────────────

export const GET_AIRPORT_BY_ICAO = gql`
  query AirportByIcao($icaoCode: String!) {
    airport(code: $icaoCode) {
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

// ─── List Contributions ─────────────────────────────────────────────────────────

export const SUBMIT_LIST_ITEM = gql`
  mutation SubmitListItem($input: SubmitListItemInput!) {
    submitListItem(input: $input) {
      id
      listType
      value
      status
    }
  }
`;

// ─── Admin Aircraft Hierarchy ──────────────────────────────────────────────────

export const ADMIN_MANUFACTURERS = gql`
  query AdminManufacturers($search: String, $first: Int, $after: String) {
    aircraftManufacturers(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          country
          createdAt
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

export const CREATE_MANUFACTURER = gql`
  mutation CreateManufacturer($input: CreateManufacturerInput!) {
    createManufacturer(input: $input) {
      id
    }
  }
`;

export const UPDATE_MANUFACTURER = gql`
  mutation UpdateManufacturer($id: ID!, $input: UpdateManufacturerInput!) {
    updateManufacturer(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_MANUFACTURER = gql`
  mutation DeleteManufacturer($id: ID!) {
    deleteManufacturer(id: $id)
  }
`;

export const UPSERT_MANUFACTURER = gql`
  mutation UpsertManufacturer($input: CreateManufacturerInput!) {
    upsertManufacturer(input: $input) {
      id
    }
  }
`;

export const ADMIN_FAMILIES = gql`
  query AdminFamilies($search: String, $first: Int, $after: String) {
    aircraftFamilies(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          manufacturer {
            id
            name
          }
          createdAt
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

export const CREATE_FAMILY = gql`
  mutation CreateFamily($input: CreateFamilyInput!) {
    createFamily(input: $input) {
      id
    }
  }
`;

export const UPDATE_FAMILY = gql`
  mutation UpdateFamily($id: ID!, $input: UpdateFamilyInput!) {
    updateFamily(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_FAMILY = gql`
  mutation DeleteFamily($id: ID!) {
    deleteFamily(id: $id)
  }
`;

export const UPSERT_FAMILY = gql`
  mutation UpsertFamily($input: CreateFamilyInput!) {
    upsertFamily(input: $input) {
      id
    }
  }
`;

export const DELETE_VARIANT = gql`
  mutation DeleteVariant($id: ID!) {
    deleteVariant(id: $id)
  }
`;

export const ADMIN_VARIANTS = gql`
  query AdminVariants($search: String, $first: Int, $after: String) {
    aircraftVariants(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          family {
            id
            name
            manufacturer {
              id
              name
            }
          }
          iataCode
          icaoCode
          createdAt
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

export const CREATE_VARIANT = gql`
  mutation CreateVariant($input: CreateVariantInput!) {
    createVariant(input: $input) {
      id
    }
  }
`;

export const UPDATE_VARIANT = gql`
  mutation UpdateVariant($id: ID!, $input: UpdateVariantInput!) {
    updateVariant(id: $id, input: $input) {
      id
    }
  }
`;

export const UPSERT_VARIANT = gql`
  mutation UpsertVariant($input: CreateVariantInput!) {
    upsertVariant(input: $input) {
      id
    }
  }
`;

// ─── Admin Airlines ─────────────────────────────────────────────────────────────

export const ADMIN_AIRLINES = gql`
  query AdminAirlines($search: String, $first: Int, $after: String) {
    airlines(search: $search, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          name
          icaoCode
          iataCode
          country
          callsign
          createdAt
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

export const CREATE_AIRLINE = gql`
  mutation CreateAirline($input: CreateAirlineInput!) {
    createAirline(input: $input) {
      id
    }
  }
`;

export const UPDATE_AIRLINE = gql`
  mutation UpdateAirline($id: ID!, $input: UpdateAirlineInput!) {
    updateAirline(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_AIRLINE = gql`
  mutation DeleteAirline($id: ID!) {
    deleteAirline(id: $id)
  }
`;

export const UPSERT_AIRLINE = gql`
  mutation UpsertAirline($input: CreateAirlineInput!) {
    upsertAirline(input: $input) {
      id
    }
  }
`;

// ─── Admin Photo Categories ────────────────────────────────────────────────────

export const ADMIN_PHOTO_CATEGORIES = gql`
  query AdminPhotoCategories($first: Int) {
    photoCategories {
      id
      name
      label
      sortOrder
      createdAt
    }
  }
`;

export const CREATE_PHOTO_CATEGORY = gql`
  mutation CreatePhotoCategory($input: CreatePhotoCategoryInput!) {
    createPhotoCategory(input: $input) {
      id
    }
  }
`;

export const UPDATE_PHOTO_CATEGORY = gql`
  mutation UpdatePhotoCategory($id: ID!, $input: UpdatePhotoCategoryInput!) {
    updatePhotoCategory(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_PHOTO_CATEGORY = gql`
  mutation DeletePhotoCategory($id: ID!) {
    deletePhotoCategory(id: $id)
  }
`;

export const UPSERT_PHOTO_CATEGORY = gql`
  mutation UpsertPhotoCategory($input: CreatePhotoCategoryInput!) {
    upsertPhotoCategory(input: $input) {
      id
    }
  }
`;

// ─── Admin Aircraft Specific Categories ───────────────────────────────────────

export const ADMIN_AIRCRAFT_SPECIFIC_CATEGORIES = gql`
  query AdminAircraftSpecificCategories($first: Int) {
    aircraftSpecificCategories {
      id
      name
      label
      sortOrder
      createdAt
    }
  }
`;

export const CREATE_AIRCRAFT_SPECIFIC_CATEGORY = gql`
  mutation CreateAircraftSpecificCategory($input: CreateAircraftSpecificCategoryInput!) {
    createAircraftSpecificCategory(input: $input) {
      id
    }
  }
`;

export const UPDATE_AIRCRAFT_SPECIFIC_CATEGORY = gql`
  mutation UpdateAircraftSpecificCategory($id: ID!, $input: UpdateAircraftSpecificCategoryInput!) {
    updateAircraftSpecificCategory(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_AIRCRAFT_SPECIFIC_CATEGORY = gql`
  mutation DeleteAircraftSpecificCategory($id: ID!) {
    deleteAircraftSpecificCategory(id: $id)
  }
`;

export const UPSERT_AIRCRAFT_SPECIFIC_CATEGORY = gql`
  mutation UpsertAircraftSpecificCategory($input: CreateAircraftSpecificCategoryInput!) {
    upsertAircraftSpecificCategory(input: $input) {
      id
    }
  }
`;

// ─── Admin Pending List Items ───────────────────────────────────────────────────

export const ADMIN_PENDING_LIST_ITEMS = gql`
  query AdminPendingListItems($status: String, $first: Int, $after: String) {
    pendingListItems(status: $status, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          listType
          value
          metadata
          status
          reviewNote
          submitter {
            id
            username
          }
          reviewer {
            id
            username
          }
          createdAt
          updatedAt
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

export const REVIEW_LIST_ITEM = gql`
  mutation ReviewListItem($id: ID!, $status: String!, $reviewNote: String) {
    reviewListItem(id: $id, status: $status, reviewNote: $reviewNote) {
      id
      status
      reviewNote
      reviewer {
        id
        username
      }
      updatedAt
    }
  }
`;

// ─── Export Queries ───────────────────────────────────────────────────────────

export const EXPORT_MANUFACTURERS = gql`
  query ExportManufacturers {
    aircraftManufacturers(first: 10000) {
      edges {
        node {
          id
          name
          country
        }
      }
    }
  }
`;

export const EXPORT_FAMILIES = gql`
  query ExportFamilies {
    aircraftFamilies(first: 10000) {
      edges {
        node {
          id
          name
          manufacturer {
            id
            name
          }
        }
      }
    }
  }
`;

export const EXPORT_VARIANTS = gql`
  query ExportVariants {
    aircraftVariants(first: 10000) {
      edges {
        node {
          id
          name
          family {
            id
            name
            manufacturer {
              id
              name
            }
          }
          iataCode
          icaoCode
        }
      }
    }
  }
`;

export const EXPORT_AIRLINES = gql`
  query ExportAirlines {
    airlines(first: 10000) {
      edges {
        node {
          id
          name
          icaoCode
          iataCode
          country
          callsign
        }
      }
    }
  }
`;

export const EXPORT_PHOTO_CATEGORIES = gql`
  query ExportPhotoCategories {
    photoCategories {
      id
      name
      label
      sortOrder
    }
  }
`;

export const EXPORT_AIRCRAFT_SPECIFIC_CATEGORIES = gql`
  query ExportAircraftSpecificCategories {
    aircraftSpecificCategories {
      id
      name
      label
      sortOrder
    }
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

// ─── Collectibles Marketplace ─────────────────────────────────────────────────

export const GET_MARKETPLACE_ITEMS = gql`
  query GetMarketplaceItems(
    $category: String
    $minPrice: Float
    $maxPrice: Float
    $condition: String
    $search: String
    $sortBy: MarketplaceSort
    $first: Int
    $after: String
  ) {
    marketplaceItems(
      category: $category
      minPrice: $minPrice
      maxPrice: $maxPrice
      condition: $condition
      search: $search
      sortBy: $sortBy
      first: $first
      after: $after
    ) {
      edges {
        cursor
        node {
          id
          title
          description
          priceUsd
          condition
          location
          moderationStatus
          active
          averageRating
          feedbackCount
          createdAt
          category {
            id
            name
            label
          }
          images {
            id
            variantType
            url
            width
            height
            sortOrder
          }
          seller {
            id
            bio
            website
            averageRating
            feedbackCount
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

export const GET_MARKETPLACE_ITEM = gql`
  query GetMarketplaceItem($id: ID!) {
    marketplaceItem(id: $id) {
      id
      title
      description
      priceUsd
      condition
      location
      contactEmail
      contactPhone
      moderationStatus
      moderationReason
      active
      averageRating
      feedbackCount
      createdAt
      updatedAt
      category {
        id
        name
        label
      }
      images {
        id
        variantType
        url
        width
        height
        fileSizeBytes
        sortOrder
      }
      seller {
        id
        bio
        website
        averageRating
        feedbackCount
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

export const GET_MARKETPLACE_CATEGORIES = gql`
  query GetMarketplaceCategories {
    marketplaceCategories {
      id
      name
      label
      sortOrder
      itemCount
    }
  }
`;

export const GET_SELLER_PROFILE = gql`
  query GetSellerProfile($userId: ID!) {
    sellerProfile(userId: $userId) {
      id
      bio
      website
      status
      approved
      averageRating
      feedbackCount
      createdAt
      user {
        id
        username
        profile {
          displayName
          avatarUrl
          bio
        }
      }
    }
  }
`;

export const GET_SELLER_FEEDBACK = gql`
  query GetSellerFeedback($sellerId: ID!, $first: Int, $after: String) {
    sellerFeedback(sellerId: $sellerId, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          rating
          comment
          createdAt
          buyer {
            id
            username
            profile {
              displayName
              avatarUrl
            }
          }
          item {
            id
            title
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

export const GET_MY_LISTINGS = gql`
  query GetMyListings($first: Int, $after: String) {
    myListings(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          description
          priceUsd
          condition
          location
          moderationStatus
          active
          createdAt
          category {
            id
            name
            label
          }
          images {
            id
            variantType
            url
            width
            height
            sortOrder
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

export const GET_ADMIN_MARKETPLACE_ITEMS = gql`
  query GetAdminMarketplaceItems($moderationStatus: String, $first: Int, $after: String) {
    adminMarketplaceItems(moderationStatus: $moderationStatus, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          description
          priceUsd
          condition
          location
          moderationStatus
          active
          createdAt
          category {
            id
            name
            label
          }
          seller {
            id
            user {
              id
              username
              email
              profile {
                displayName
              }
            }
          }
          images {
            id
            url
            variantType
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

export const UPDATE_SELLER_STATUS = gql`
  mutation UpdateSellerStatus($sellerProfileId: ID!, $status: SellerStatus!) {
    updateSellerStatus(sellerProfileId: $sellerProfileId, status: $status) {
      id
      status
      approved
    }
  }
`;

export const CREATE_MARKETPLACE_ITEM = gql`
  mutation CreateMarketplaceItem($input: CreateMarketplaceItemInput!) {
    createMarketplaceItem(input: $input) {
      id
      title
      description
      priceUsd
      condition
      location
      contactEmail
      contactPhone
      moderationStatus
      active
      category {
        id
        name
        label
      }
      images {
        id
        variantType
        url
        width
        height
        sortOrder
      }
    }
  }
`;

export const UPDATE_MARKETPLACE_ITEM = gql`
  mutation UpdateMarketplaceItem($id: ID!, $input: UpdateMarketplaceItemInput!) {
    updateMarketplaceItem(id: $id, input: $input) {
      id
      title
      description
      priceUsd
      condition
      location
      contactEmail
      contactPhone
      moderationStatus
      active
      category {
        id
        name
        label
      }
      images {
        id
        variantType
        url
        width
        height
        sortOrder
      }
    }
  }
`;

export const DELETE_MARKETPLACE_ITEM = gql`
  mutation DeleteMarketplaceItem($id: ID!) {
    deleteMarketplaceItem(id: $id)
  }
`;

export const MODERATE_MARKETPLACE_ITEM = gql`
  mutation ModerateMarketplaceItem($id: ID!, $status: ModerationStatus!, $reason: String) {
    moderateMarketplaceItem(id: $id, status: $status, reason: $reason) {
      id
      moderationStatus
      moderationReason
      active
    }
  }
`;

export const SUBMIT_SELLER_FEEDBACK = gql`
  mutation SubmitSellerFeedback($input: SubmitSellerFeedbackInput!) {
    submitSellerFeedback(input: $input) {
      id
      rating
      comment
      createdAt
    }
  }
`;

export const GET_MARKETPLACE_UPLOAD_URL = gql`
  mutation GetMarketplaceItemUploadUrl($input: GetUploadUrlInput!) {
    getMarketplaceItemUploadUrl(input: $input) {
      url
      key
    }
  }
`;

export const CREATE_MARKETPLACE_CATEGORY = gql`
  mutation CreateMarketplaceCategory($input: CreateMarketplaceCategoryInput!) {
    createMarketplaceCategory(input: $input) {
      id
      name
      label
      sortOrder
    }
  }
`;

export const UPDATE_MARKETPLACE_CATEGORY = gql`
  mutation UpdateMarketplaceCategory($id: ID!, $input: UpdateMarketplaceCategoryInput!) {
    updateMarketplaceCategory(id: $id, input: $input) {
      id
      name
      label
      sortOrder
    }
  }
`;

export const DELETE_MARKETPLACE_CATEGORY = gql`
  mutation DeleteMarketplaceCategory($id: ID!) {
    deleteMarketplaceCategory(id: $id)
  }
`;

// ─── Marketplace ─────────────────────────────────────────────────────────────

export const MARKETPLACE_LISTINGS = gql`
  query MarketplaceListings($first: Int, $after: String, $sortBy: MarketplaceSort) {
    marketplaceListings(first: $first, after: $after, sortBy: $sortBy) {
      edges {
        cursor
        node {
          id
          caption
          originalUrl
          originalWidth
          originalHeight
          likeCount
          commentCount
          hasActiveListing
          listing {
            id
            priceUsd
            active
          }
          variants {
            id
            variantType
            url
            width
            height
          }
          user {
            id
            username
            profile {
              displayName
              avatarUrl
            }
          }
          aircraft {
            registration
            airline
            manufacturer {
              name
            }
            family {
              name
            }
            variant {
              name
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

export const MY_PURCHASES = gql`
  query MyPurchases($first: Int, $after: String) {
    myPurchases(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          status
          amountUsd
          platformFeeUsd
          createdAt
          photo {
            id
            caption
            originalUrl
            variants {
              id
              variantType
              url
              width
              height
            }
          }
          seller {
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

export const MY_SALES = gql`
  query MySales($first: Int, $after: String) {
    mySales(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          status
          amountUsd
          platformFeeUsd
          createdAt
          photo {
            id
            caption
            originalUrl
            variants {
              id
              variantType
              url
              width
              height
            }
          }
          buyer {
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

export const ADMIN_SELLER_APPLICATIONS = gql`
  query AdminSellerApplications($first: Int, $after: String) {
    adminSellerApplications(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          approved
          bio
          website
          stripeOnboardingComplete
          createdAt
          user {
            id
            username
            email
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

export const APPLY_TO_SELL = gql`
  mutation ApplyToSell($input: ApplyToSellInput!) {
    applyToSell(input: $input) {
      id
      approved
      bio
      website
      stripeOnboardingComplete
      createdAt
      user {
        id
        username
        email
      }
    }
  }
`;

export const APPROVE_SELLER = gql`
  mutation ApproveSeller($sellerProfileId: ID!) {
    approveSeller(sellerProfileId: $sellerProfileId) {
      sellerProfile {
        id
        approved
        stripeAccountId
        stripeOnboardingComplete
      }
      onboardingUrl
    }
  }
`;

export const CREATE_OR_UPDATE_LISTING = gql`
  mutation CreateOrUpdateListing($input: CreateOrUpdateListingInput!) {
    createOrUpdateListing(input: $input) {
      id
      photoId
      priceUsd
      active
      createdAt
      updatedAt
      photo {
        id
        caption
        originalUrl
        variants {
          id
          variantType
          url
          width
          height
        }
      }
    }
  }
`;

export const REMOVE_LISTING = gql`
  mutation RemoveListing($photoId: ID!) {
    removeListing(photoId: $photoId)
  }
`;

export const CREATE_PHOTO_PURCHASE = gql`
  mutation CreatePhotoPurchase($listingId: ID!) {
    createPhotoPurchase(listingId: $listingId) {
      sessionId
      checkoutUrl
    }
  }
`;
