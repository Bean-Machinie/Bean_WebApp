export const fetchImageAsDataUrl = async (src: string, cache?: Map<string, string>): Promise<string> => {
  if (!src) return src;
  if (src.startsWith('data:')) return src;

  const existing = cache?.get(src);
  if (existing) return existing;

  try {
    const response = await fetch(src, { mode: 'cors' });
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to data URL'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    cache?.set(src, dataUrl);
    return dataUrl;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to inline image', error);
    return src;
  }
};

export const loadImageFromUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (event) => reject(event);
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.src = url;
  });

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  requestAnimationFrame(() => link.remove());
};
