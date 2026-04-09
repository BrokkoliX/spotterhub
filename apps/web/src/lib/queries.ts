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
  ) {
    photos(
      first: $first
      after: $after
      userId: $userId
      albumId: $albumId
      aircraftType: $aircraftType
      airportCode: $airportCode
      tags: $tags
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

// ─── Airports & Map ─────────────────────────────────────────────────────────

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
