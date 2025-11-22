import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type AvatarUploadModalProps = {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onAvatarUpdated: (path: string) => void;
  initialPreview?: string;
};

const CROP_SIZE = 240;
const EXPORT_SIZE = 512;

function getCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to export avatar'));
    }, 'image/jpeg', 0.92);
  });
}

function AvatarUploadModal({ isOpen, userId, onClose, onAvatarUpdated, initialPreview }: AvatarUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialPreview);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDragging(false);
      setError(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    setPreviewUrl(initialPreview);
  }, [initialPreview]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setPosition({ x: 0, y: 0 });
      setScale(1);
    };
    reader.readAsDataURL(file);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPosition((current) => ({ x: current.x + event.movementX, y: current.y + event.movementY }));
  };

  const exportCroppedImage = async () => {
    if (!imageRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const img = imageRef.current;
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    const imageLeft = CROP_SIZE / 2 + position.x - scaledWidth / 2;
    const imageTop = CROP_SIZE / 2 + position.y - scaledHeight / 2;

    const sourceX = Math.max(0, -imageLeft / scale);
    const sourceY = Math.max(0, -imageTop / scale);
    const sourceWidth = Math.min(img.naturalWidth - sourceX, CROP_SIZE / scale);
    const sourceHeight = Math.min(img.naturalHeight - sourceY, CROP_SIZE / scale);

    ctx.save();
    ctx.beginPath();
    ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      EXPORT_SIZE,
      EXPORT_SIZE,
    );

    ctx.restore();

    return getCanvasBlob(canvas);
  };

  const handleSave = async () => {
    if (!previewUrl || !userId) return;
    setIsSaving(true);
    setError(null);

    try {
      const blob = await exportCroppedImage();
      if (!blob) throw new Error('Could not crop image.');

      const path = `avatars/${userId}.jpg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });

      if (uploadError) throw uploadError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', userId);

      if (profileError) throw profileError;

      onAvatarUpdated(path);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update avatar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="avatar-modal__backdrop">
      <div className="avatar-modal" role="dialog" aria-modal="true">
        <div className="avatar-modal__header">
          <div>
            <h3>Update profile picture</h3>
            <p>Upload a new photo, then zoom or drag to fit inside the circle.</p>
          </div>
          <button className="avatar-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="avatar-modal__body">
          <div
            className="avatar-modal__stage"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
          >
            {previewUrl ? (
              <div className="avatar-modal__cropper" style={{ width: CROP_SIZE, height: CROP_SIZE }}>
                <div className="avatar-modal__cropper-frame" />
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Avatar preview"
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px)) scale(${scale})`,
                  }}
                />
              </div>
            ) : (
              <div className="avatar-modal__placeholder">
                <p>Select an image to begin.</p>
              </div>
            )}
          </div>

          <div className="avatar-modal__controls">
            <label className="avatar-modal__control">
              <span>Zoom</span>
              <input
                type="range"
                min={0.8}
                max={2.4}
                step={0.01}
                value={scale}
                onChange={(event) => setScale(parseFloat(event.target.value))}
              />
            </label>
            <div className="avatar-modal__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                Choose file
              </button>
              <button className="button button--primary" type="button" onClick={handleSave} disabled={isSaving || !previewUrl}>
                {isSaving ? 'Saving...' : 'Save avatar'}
              </button>
            </div>
            {error ? <p className="avatar-modal__error">{error}</p> : null}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

export default AvatarUploadModal;
