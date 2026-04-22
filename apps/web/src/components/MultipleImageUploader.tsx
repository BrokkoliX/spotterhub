'use client';

import { useRef, useState } from 'react';

interface ImageUploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  uploadedKey: string | null;
  error: string | null;
}

interface UploadedImage {
  key: string;
  preview: string;
}

interface MultipleImageUploaderProps {
  /** Max number of images */
  maxImages?: number;
  /** Called with array of uploaded S3 keys when images are ready */
  onImagesUploaded: (keys: string[]) => void;
  /** S3 upload function */
  uploadFn: (file: File) => Promise<string>;
}

/**
 * Simple multi-image uploader for marketplace items.
 * Shows a grid of upload slots. Each slot accepts a file, uploads to S3,
 * and stores the returned S3 key. The parent receives all keys via onImagesUploaded.
 */
export function MultipleImageUploader({ maxImages = 8, onImagesUploaded, uploadFn }: MultipleImageUploaderProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [images, setImages] = useState<ImageUploadState[]>(() =>
    Array.from({ length: maxImages }, () => ({ file: null, preview: null, uploading: false, uploadedKey: null, error: null })),
  );

  const handleFileChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setImages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], file, preview: reader.result as string, uploading: true, error: null };
        return next;
      });
    };
    reader.readAsDataURL(file);

    try {
      const key = await uploadFn(file);
      setImages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], uploading: false, uploadedKey: key };
        return next;
      });

      // Notify parent of all uploaded keys
      const allKeys = images
        .map((img, i) => (i === index ? key : img.uploadedKey))
        .filter((k): k is string => k !== null);
      onImagesUploaded(allKeys);
    } catch (err) {
      setImages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], uploading: false, error: 'Upload failed' };
        return next;
      });
    }

    // Reset input so same file can be selected again
    // eslint-disable-next-line react-hooks/immutability -- direct DOM ref reset is safe here
    if (inputRefs.current[index]) inputRefs.current[index].value = '';
  };

  const handleRemove = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = { file: null, preview: null, uploading: false, uploadedKey: null, error: null };
      return next;
    });
    const remainingKeys = images
      .map((img, i) => (i === index ? null : img.uploadedKey))
      .filter((k): k is string => k !== null);
    onImagesUploaded(remainingKeys);
  };

  const uploadedCount = images.filter((img) => img.uploadedKey).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {images.map((img, index) => (
          <div key={index} style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                width: '120px',
                height: '90px',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                background: '#f3f4f6',
                border: img.error ? '2px solid #dc2626' : '2px dashed #d1d5db',
              }}
            >
              {img.preview ? (
                <>
                  <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {img.uploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem' }}>
                      Uploading…
                    </div>
                  )}
                </>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', color: '#9ca3af', fontSize: '0.75rem', gap: '4px' }}>
                  <span style={{ fontSize: '1.5rem' }}>📷</span>
                  <span>Add photo</span>
                  <input
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileChange(index, e)}
                  />
                </label>
              )}
            </div>
            {img.uploadedKey && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
              >
                Remove
              </button>
            )}
            {img.error && <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>{img.error}</span>}
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)', margin: 0 }}>
        {uploadedCount} photo{uploadedCount !== 1 ? 's' : ''} uploaded — click each slot to add more
      </p>
    </div>
  );
}