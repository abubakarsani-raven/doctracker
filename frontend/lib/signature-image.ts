/**
 * Remove near-white paper from a signature photo, leaving ink on a transparent
 * background. Tuned for black/blue pen on white or cream paper — not a general
 * ML background remover.
 */
export async function removeSignaturePaperBackground(
  source: File | Blob | string,
  options?: {
    /** Luminance above this (0–255) becomes transparent. Default 232. */
    whiteThreshold?: number;
    /** Soft edge width in luminance units. Default 28. */
    feather?: number;
    /** Max output width in px (keeps memory bounded). Default 1200. */
    maxWidth?: number;
  },
): Promise<string> {
  const whiteThreshold = options?.whiteThreshold ?? 232;
  const feather = options?.feather ?? 28;
  const maxWidth = options?.maxWidth ?? 1200;

  const objectUrl =
    typeof source === "string" ? null : URL.createObjectURL(source);
  const src = typeof source === "string" ? source : objectUrl!;

  try {
    const img = await loadImage(src);
    const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not process signature image");

    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceived luminance — cream paper is slightly warm, so weight green.
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (luminance >= whiteThreshold) {
        data[i + 3] = 0;
        continue;
      }

      // Soft fade near the threshold so anti-aliased ink edges stay smooth.
      if (luminance > whiteThreshold - feather) {
        const t = (whiteThreshold - luminance) / feather;
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, t)));
      }

      // Darken residual grey so faint pen strokes read as ink on the PDF.
      if (data[i + 3] > 0 && luminance > 40) {
        const ink = Math.max(0, Math.min(255, luminance * 0.35));
        data[i] = ink;
        data[i + 1] = ink;
        data[i + 2] = ink;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const cropped = cropToOpaqueContent(canvas);
    return cropped.toDataURL("image/png");
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read signature image"));
    img.src = src;
  });
}

/** Trim transparent padding so the stamp box matches the ink bounds. */
function cropToOpaqueContent(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;

  const { width, height } = source;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return source;

  const pad = 4;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const outCtx = out.getContext("2d");
  if (!outCtx) return source;
  outCtx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}
