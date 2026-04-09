'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_ALBUM, GET_ALBUMS } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AlbumVariant {
  variantType: string;
  url: string;
  width: number;
  height: number;
}

interface AlbumNode {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  photoCount: number;
  coverPhoto?: {
    id: string;
    variants: AlbumVariant[];
  } | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AlbumsPage() {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [albumsResult, refetchAlbums] = useQuery({
    query: GET_ALBUMS,
    variables: { first: 50 },
    pause: !user,
  });

  const [createResult, createAlbum] = useMutation(CREATE_ALBUM);

  const albums: AlbumNode[] =
    albumsResult.data?.albums?.edges?.map(
      (e: { node: AlbumNode }) => e.node,
    ) ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const res = await createAlbum({
      input: {
        title: title.trim(),
        description: description.trim() || null,
        isPublic,
      },
    });

    if (!res.error) {
      setTitle('');
      setDescription('');
      setIsPublic(true);
      setShowCreate(false);
      refetchAlbums({ requestPolicy: 'network-only' });
    }
  };

  // ─── Not Signed In ──────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className={styles.page}>
        <div className="container">
          <div className={styles.empty}>
            <p>Sign in to view and create albums.</p>
            <Link href="/signin" className="btn btn-primary">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>My Albums</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            + New Album
          </button>
        </div>

        {albumsResult.fetching && (
          <p className={styles.loading}>Loading albums…</p>
        )}

        {albumsResult.error && (
          <p className={styles.error}>{albumsResult.error.message}</p>
        )}

        {!albumsResult.fetching && albums.length === 0 && (
          <div className={styles.empty}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📸</div>
            <p>You don&apos;t have any albums yet.</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
            >
              Create Your First Album
            </button>
          </div>
        )}

        {albums.length > 0 && (
          <div className={styles.grid}>
            {albums.map((album) => {
              const coverVariant = album.coverPhoto?.variants?.find(
                (v) => v.variantType === 'display',
              );

              return (
                <Link
                  key={album.id}
                  href={`/albums/${album.id}`}
                  className={styles.card}
                >
                  <div className={styles.coverWrapper}>
                    {coverVariant ? (
                      <Image
                        src={coverVariant.url}
                        alt={album.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className={styles.coverImage}
                      />
                    ) : (
                      <span className={styles.coverPlaceholder}>📷</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>
                      {album.title}
                      {!album.isPublic && (
                        <span className={styles.privateIcon} title="Private">
                          🔒
                        </span>
                      )}
                    </div>
                    <div className={styles.cardMeta}>
                      {album.photoCount}{' '}
                      {album.photoCount === 1 ? 'photo' : 'photos'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ─── Create Album Modal ──────────────────────────────────────── */}
        {showCreate && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCreate(false);
            }}
          >
            <form className={styles.modal} onSubmit={handleCreate}>
              <h2 className={styles.modalTitle}>New Album</h2>

              <div className={styles.field}>
                <label htmlFor="album-title">Title</label>
                <input
                  id="album-title"
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., KSEA Spotting 2026"
                  autoFocus
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="album-desc">Description (optional)</label>
                <textarea
                  id="album-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this album about?"
                />
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                Public album
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!title.trim() || createResult.fetching}
                >
                  {createResult.fetching ? 'Creating…' : 'Create Album'}
                </button>
              </div>

              {createResult.error && (
                <p className={styles.error}>{createResult.error.message}</p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
