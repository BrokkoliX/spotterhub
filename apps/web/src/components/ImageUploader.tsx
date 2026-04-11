'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface ImageUploaderHandle {
  triggerUpload: () => void;
}

interface ImageUploaderProps {
  /** Current image URL (shown as preview) */
  currentUrl?: string | null;
  /** Label shown on the empty state */
  label?: string;
  /** Aspect ratio of the image (e.g. "16/9", "1/1") */
  aspectRatio?: string;
  /**
   * Called with the selected File for uploading to S3.
   * The parent should upload to S3 and return the final URL string.
   * The uploader shows a local preview while the upload is in progress.
   */
  onUpload: (file: File) => Promise<string>;
  /** Optional: called when the user applies a direct URL (instead of uploading a file) */
  onUrl?: (url: string) => void;
  /** Show a loading spinner overlay */
  uploading?: boolean;
  /** Text shown on the Change button */
  uploadLabel?: string;
}

export const ImageUploader = forwardRef<ImageUploaderHandle, ImageUploaderProps>(
  (
    {
      currentUrl,
      label = 'Upload Image',
      aspectRatio = '16/9',
      onUpload,
      onUrl,
      uploading = false,
      uploadLabel = 'Change',
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [localUploading, setLocalUploading] = useState(false);
    const [urlMode, setUrlMode] = useState(false);
    const [urlInput, setUrlInput] = useState('');

    // Keep preview in sync with parent URL when not uploading
    const effectivePreview = preview ?? currentUrl;

    useImperativeHandle(ref, () => ({
      triggerUpload: () => inputRef.current?.click(),
    }));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Show local preview immediately while uploading
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      setLocalUploading(true);
      try {
        const url = await onUpload(file);
        // On success, set the preview to the actual uploaded URL
        setPreview(url);
      } finally {
        setLocalUploading(false);
      }

      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    };

    const handleUrlSubmit = () => {
      if (urlInput.trim()) {
        setPreview(urlInput.trim());
        onUrl ? onUrl(urlInput.trim()) : onUpload(new File([], 'url', { type: 'image/*' })).catch(() => {});
        setUrlMode(false);
        setUrlInput('');
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {effectivePreview ? (
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              aspectRatio,
              background: 'var(--color-bg-input)',
            }}
          >
            <img
              src={effectivePreview}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {(localUploading || uploading) && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
              >
                Uploading…
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '1')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = '0')}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => inputRef.current?.click()}
                  disabled={localUploading || uploading}
                >
                  {localUploading || uploading ? 'Uploading…' : uploadLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setUrlMode(true)}
                >
                  URL
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '32px',
              background: 'var(--color-bg-input)',
              border: '2px dashed var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              transition: 'border-color 0.15s',
            }}
            onClick={() => inputRef.current?.click()}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)')}
          >
            <span style={{ fontSize: '1.5rem' }}>📷</span>
            <span style={{ fontSize: '0.875rem' }}>{label}</span>
          </div>
        )}

        {urlMode && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              className="input"
              placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-primary" onClick={handleUrlSubmit}>
              Apply
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setUrlMode(false)}>
              Cancel
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    );
  },
);

ImageUploader.displayName = 'ImageUploader';
