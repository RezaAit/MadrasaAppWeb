/**
 * Client-side image compression — canvas-based, like Squoosh.
 *
 * Strategy:
 *  1. Decode image into a canvas
 *  2. Downscale if either dimension exceeds maxPx (maintains aspect ratio)
 *  3. Re-encode as JPEG at given quality
 *  4. If output is still > maxBytes, reduce quality iteratively
 *
 * Returns: { blob, dataUrl, originalKB, compressedKB, width, height }
 */
export async function compressImage(file, {
  maxPx    = 1600,   // max width or height in pixels
  quality  = 0.82,   // initial JPEG quality (0–1)
  maxBytes = 400_000 // 400 KB hard cap; will reduce quality to meet it
} = {}) {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down if too large
  if (width > maxPx || height > maxPx) {
    const scale = maxPx / Math.max(width, height);
    width  = Math.round(width  * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try at initial quality, then step down until under maxBytes
  let blob;
  let q = quality;
  do {
    blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
    q = Math.round((q - 0.08) * 100) / 100;
  } while (blob.size > maxBytes && q > 0.25);

  const dataUrl = await _blobToDataUrl(blob);

  return {
    blob,
    dataUrl,
    width,
    height,
    originalKB:    Math.round(file.size / 1024),
    compressedKB:  Math.round(blob.size / 1024),
  };
}

function _blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
