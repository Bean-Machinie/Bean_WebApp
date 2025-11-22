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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
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
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const exportCroppedImage = async () => {
    if (!imageRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const img = imageRef.current;
    const scale = Math.max(EXPORT_SIZE / img.naturalWidth, EXPORT_SIZE / img.naturalHeight);
    const targetWidth = img.naturalWidth * scale;
    const targetHeight = img.naturalHeight * scale;
    const offsetX = (EXPORT_SIZE - targetWidth) / 2;
    const offsetY = (EXPORT_SIZE - targetHeight) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, offsetX, offsetY, targetWidth, targetHeight);

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
            <p>Upload a new photo and we will place it in your avatar automatically.</p>
          </div>
          <button className="avatar-modal__close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <div className="avatar-modal__body">
          <div className="avatar-modal__stage">
            {previewUrl ? (
              <div className="avatar-modal__cropper" style={{ width: CROP_SIZE, height: CROP_SIZE }}>
                <img ref={imageRef} src={previewUrl} alt="Avatar preview" />
                <div className="avatar-modal__cropper-frame" />
              </div>
            ) : (
              <div className="avatar-modal__placeholder">
                <p>Select an image to begin.</p>
              </div>
            )}
          </div>

          <div className="avatar-modal__controls">
            <p className="avatar-modal__helper">
              Choose an image and it will be centered within the circular frame.
            </p>
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
