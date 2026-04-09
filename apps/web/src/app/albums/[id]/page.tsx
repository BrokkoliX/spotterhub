'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { AddPhotosModal } from '@/components/AddPhotosModal';
import type { PhotoData } from '@/components/PhotoCard';
import { PhotoGrid } from '@/components/PhotoGrid';
import {
  DELETE_ALBUM,
  GET_ALBUM,
  GET_PHOTOS,
  UPDATE_ALBUM,
} from '@/lib/queries';

import styles from './page.module.css';

const PAGE_SIZE = 20;

// ─── Component ──────────────────────────────────────────────────────────────

export default function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddPhotos, setShowAddPhotos] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoData[]>([]);

  const [albumResult, reexecuteAlbumQuery] = useQuery({
    query: GET_ALBUM,
    variables: { id },
  });

  const [photosResult, reexecutePhotosQuery] = useQuery({
    query: GET_PHOTOS,
    variables: { first: PAGE_SIZE, after: cursor, albumId: id },
  });

  const [, updateAlbum] = useMutation(UPDATE_ALBUM);
  const [deleteResult, deleteAlbum] = useMutation(DELETE_ALBUM);

  const album = albumResult.data?.album;
  const connection = photosResult.data?.photos;

  const photos: PhotoData[] =
    allPhotos.length > 0
      ? allPhotos
      : connection?.edges?.map((e: { node: PhotoData }) => e.node) ?? [];

  const isOwner = user?.username === album?.user?.username;

  const handleLoadMore = useCallback(() => {
    if (connection?.pageInfo?.endCursor) {
      setAllPhotos((prev) => {
        const existing = prev.length > 0 ? prev : photos;
        const newPhotos = connection.edges
          .map((e: { node: PhotoData }) => e.node)
          .filter(
            (p: PhotoData) =>
              !existing.some((ep: PhotoData) => ep.id === p.id),
          );
        return [...existing, ...newPhotos];
      });
      setCursor(connection.pageInfo.endCursor);
    }
  }, [connection, photos]);

  const openEdit = () => {
    setEditTitle(album?.title ?? '');
    setEditDesc(album?.description ?? '');
    setEditPublic(album?.isPublic ?? true);
    setShowEdit(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAlbum({
      id,
      input: {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        isPublic: editPublic,
      },
    });
    setShowEdit(false);
  };

  const handleDelete = async () => {
    const res = await deleteAlbum({ id });
    if (!res.error) {
      router.push('/albums');
    }
  };

  const handlePhotosAdded = () => {
    setAllPhotos([]);
    setCursor(null);
    reexecuteAlbumQuery({ requestPolicy: 'network-only' });
    reexecutePhotosQuery({ requestPolicy: 'network-only' });
  };

  // ─── Loading / Not Found ────────────────────────────────────────────────

  if (albumResult.fetching) {
    return (
      <div className={styles.page}>
        <div className="container">
          <p className={styles.loading}>Loading album…</p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className={styles.page}>
        <div className="container">
          <Link href="/albums" className={styles.backLink}>
            ← Back to albums
          </Link>
          <div className={styles.notFound}>
            <h2>Album not found</h2>
            <p>This album may have been deleted.</p>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    album.user.profile?.displayName ?? album.user.username;

  return (
    <div className={styles.page}>
      <div className="container">
        <Link href="/albums" className={styles.backLink}>
          ← Back to albums
        </Link>

        {/* Album Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.albumTitle}>
                {album.title}
                {!album.isPublic && (
                  <span className={styles.privateIcon} title="Private">
                    🔒
                  </span>
                )}
              </h1>
            </div>
            {isOwner && (
              <div className={styles.ownerActions}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddPhotos(true)}
                >
                  + Add Photos
                </button>
                <button className="btn btn-secondary" onClick={openEdit}>
                  Edit
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDelete(true)}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {album.description && (
            <p className={styles.albumDesc}>{album.description}</p>
          )}

          <div className={styles.albumMeta}>
            <span>
              by{' '}
              <Link href={`/u/${album.user.username}/photos`}>
                {displayName}
              </Link>
            </span>
            <span>
              📷 {album.photoCount}{' '}
              {album.photoCount === 1 ? 'photo' : 'photos'}
            </span>
          </div>
        </div>

        {/* Photos */}
        <div className={styles.section}>
          <PhotoGrid
            photos={photos}
            hasNextPage={connection?.pageInfo?.hasNextPage ?? false}
            loading={photosResult.fetching}
            onLoadMore={handleLoadMore}
            emptyMessage="No photos in this album yet"
          />
        </div>

        {/* ─── Edit Modal ──────────────────────────────────────────────── */}
        {showEdit && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowEdit(false);
            }}
          >
            <form className={styles.modal} onSubmit={handleUpdate}>
              <h2 className={styles.modalTitle}>Edit Album</h2>

              <div className={styles.field}>
                <label htmlFor="edit-title">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  maxLength={100}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="edit-desc">Description</label>
                <textarea
                  id="edit-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                />
                Public album
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEdit(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Delete Confirmation ─────────────────────────────────────── */}
        {showDelete && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDelete(false);
            }}
          >
            <div className={styles.modal}>
              <h2 className={styles.modalTitle}>Delete Album?</h2>
              <p style={{ marginBottom: '16px', fontSize: '0.9375rem' }}>
                This will delete the album &ldquo;{album.title}&rdquo;.
                Photos in the album will not be deleted.
              </p>
              <div className={styles.modalActions}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowDelete(false)}
                >
                  Cancel
                </button>
                <button
                  className={`btn btn-primary ${styles.dangerBtn}`}
                  onClick={handleDelete}
                  disabled={deleteResult.fetching}
                >
                  {deleteResult.fetching ? 'Deleting…' : 'Delete Album'}
                </button>
              </div>
              {deleteResult.error && (
                <p className={styles.error}>{deleteResult.error.message}</p>
              )}
            </div>
          </div>
        )}

        {/* ─── Add Photos Modal ───────────────────────────────────────── */}
        {showAddPhotos && (
          <AddPhotosModal
            albumId={id}
            existingPhotoIds={
              new Set(photos.map((p: PhotoData) => p.id))
            }
            onClose={() => setShowAddPhotos(false)}
            onAdded={handlePhotosAdded}
          />
        )}
      </div>
    </div>
  );
}
