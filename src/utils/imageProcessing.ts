import { DetectedCell, AnalysisParams, CellType } from '../types';

declare global {
  interface Window {
    cv?: any;
  }
}

// Helper to determine pixels per micrometer based on magnification
export function getPixelsPerUm(mag: number): number {
  switch (mag) {
    case 10: return 1.0;
    case 40: return 4.0;
    case 100: return 10.0;
    default: return 4.0;
  }
}

// Convert RGB to HSV
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360), // 0-360
    s: Math.round(s * 100), // 0-100
    v: Math.round(v * 100), // 0-100
  };
}

/**
 * Custom Fallback Analysis using HTML5 Canvas 2D Context
 * Highly optimized, robust BFS-based blob detection.
 */
export function runFallbackAnalysis(
  canvas: HTMLCanvasElement,
  params: AnalysisParams,
  onProgress: (p: number) => void
): { cells: DetectedCell[]; rbc: number; wbc: number; plt: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  onProgress(10);
  const W = canvas.width;
  const H = canvas.height;
  const ppu = getPixelsPerUm(params.mag);

  // Get image data
  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;
  const totalPixels = W * H;

  onProgress(20);

  // 1. Calculate average brightness to determine adaptive threshold
  let brightnessSum = 0;
  // Sample every 4th pixel to speed up background estimation
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    brightnessSum += (r + g + b) / 3;
  }
  const avgBrightness = brightnessSum / (totalPixels / 4);

  // 2. Thresholding logic
  // Stained blood cells are dark on a light background.
  // In unstained, they can also be dark/shadowy.
  // We want to detect dark spots (cells) in contrast to light background.
  const isStained = params.imgType === 'stained';
  const threshold = isStained ? avgBrightness * 0.92 : avgBrightness * 0.88;

  // 3. Blob extraction (BFS)
  const visited = new Uint8Array(totalPixels);
  const cells: DetectedCell[] = [];
  let rbcCount = 0;
  let wbcCount = 0;
  let pltCount = 0;
  let cellIdCounter = 1;

  onProgress(40);

  // Queue allocation reuse to prevent GC thrashing
  const queue = new Int32Array(Math.min(totalPixels, 50000));
  let head = 0;
  let tail = 0;

  for (let y = 4; y < H - 4; y += 2) {
    for (let x = 4; x < W - 4; x += 2) {
      const idx = y * W + x;
      if (visited[idx]) continue;

      const offset = idx * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const brightness = (r + g + b) / 3;

      // Dark spot detected! (cell candidate)
      if (brightness < threshold) {
        head = 0;
        tail = 0;
        queue[tail++] = idx;
        visited[idx] = 1;

        let blobSize = 0;
        let cxSum = 0;
        let cySum = 0;
        let xMin = x;
        let xMax = x;
        let yMin = y;
        let yMax = y;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;

        // BFS loop
        while (head < tail && blobSize < params.maxArea) {
          const currIdx = queue[head++];
          const cx = currIdx % W;
          const cy = Math.floor(currIdx / W);

          blobSize++;
          cxSum += cx;
          cySum += cy;

          if (cx < xMin) xMin = cx;
          if (cx > xMax) xMax = cx;
          if (cy < yMin) yMin = cy;
          if (cy > yMax) yMax = cy;

          const coff = currIdx * 4;
          rSum += data[coff];
          gSum += data[coff + 1];
          bSum += data[coff + 2];

          // Check 4-connected neighbors
          const neighbors = [currIdx - 1, currIdx + 1, currIdx - W, currIdx + W];
          for (let n = 0; n < 4; n++) {
            const nidx = neighbors[n];
            if (nidx >= 0 && nidx < totalPixels && !visited[nidx]) {
              const noff = nidx * 4;
              const nB = (data[noff] + data[noff + 1] + data[noff + 2]) / 3;

              if (nB < threshold) {
                visited[nidx] = 1;
                if (tail < queue.length) {
                  queue[tail++] = nidx;
                }
              }
            }
          }
        }

        // Validate blob size
        if (blobSize >= params.minSize && blobSize <= params.maxArea) {
          const cx = Math.round(cxSum / blobSize);
          const cy = Math.round(cySum / blobSize);
          const bw = xMax - xMin + 1;
          const bh = yMax - yMin + 1;
          const bArea = bw * bh;

          const rAvg = Math.round(rSum / blobSize);
          const gAvg = Math.round(gSum / blobSize);
          const bAvg = Math.round(bSum / blobSize);

          const hsv = rgbToHsv(rAvg, gAvg, bAvg);

          // Calculate metrics
          const areaUm2 = blobSize / (ppu * ppu);
          const diameter = 2 * Math.sqrt(areaUm2 / Math.PI);
          const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));

          // Estimate circularity
          const perimeterEst = Math.PI * (bw + bh) / 2;
          const circularity = (4 * Math.PI * blobSize) / (perimeterEst * perimeterEst);
          const solidity = blobSize / bArea;

          // Classification logic
          let type: CellType = 'rbc';

          // WBCs: Larger, purple/violet in stained (high saturation in blue/purple range), or simply very large
          // Platelets: Very small
          const isPlatelet = areaUm2 < 7.5;
          const isWbc = (isStained && hsv.h >= 240 && hsv.h <= 320 && hsv.s > 15 && areaUm2 > 45) ||
                        (!isStained && areaUm2 > 85) ||
                        (areaUm2 > 110 && circularity < 0.72);

          if (isPlatelet) {
            type = 'platelet';
            pltCount++;
          } else if (isWbc) {
            type = 'wbc';
            wbcCount++;
          } else {
            type = 'rbc';
            rbcCount++;
          }

          cells.push({
            id: `c_${cellIdCounter++}`,
            type,
            area: blobSize,
            aum: parseFloat(areaUm2.toFixed(2)),
            dia: parseFloat(diameter.toFixed(2)),
            circ: parseFloat(Math.min(1.0, Math.max(0.01, circularity)).toFixed(3)),
            sol: parseFloat(Math.min(1.0, Math.max(0.01, solidity)).toFixed(3)),
            hue: hsv.h,
            sat: hsv.s,
            cx,
            cy,
            bw,
            bh,
            ar: parseFloat(aspect.toFixed(2)),
          });
        }
      }
    }
  }

  onProgress(80);

  // Redraw the bounding boxes on the canvas
  ctx.putImageData(imgData, 0, 0);

  // Apply beautiful styling overlay
  cells.forEach(cell => {
    ctx.lineWidth = 2.5;
    if (cell.type === 'rbc') {
      ctx.strokeStyle = '#22c55e'; // green-500
      ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
    } else if (cell.type === 'wbc') {
      ctx.strokeStyle = '#ef4444'; // red-500
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    } else {
      ctx.strokeStyle = '#eab308'; // yellow-500
      ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
    }

    // Draw box
    ctx.strokeRect(cell.cx - cell.bw/2, cell.cy - cell.bh/2, cell.bw, cell.bh);
    ctx.fillRect(cell.cx - cell.bw/2, cell.cy - cell.bh/2, cell.bw, cell.bh);

    // Draw text indicator
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    const text = cell.type === 'rbc' ? 'R' : cell.type === 'wbc' ? 'W' : 'P';
    const textWidth = ctx.measureText(text).width;

    ctx.fillStyle = cell.type === 'rbc' ? '#22c55e' : cell.type === 'wbc' ? '#ef4444' : '#eab308';
    ctx.fillRect(cell.cx - cell.bw/2, cell.cy - cell.bh/2 - 14, textWidth + 8, 14);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cell.cx - cell.bw/2 + 4, cell.cy - cell.bh/2 - 3);
  });

  onProgress(100);

  return {
    cells,
    rbc: rbcCount,
    wbc: wbcCount,
    plt: pltCount,
  };
}

/**
 * OpenCV.js Contour-based Segmentation and Detection
 */
export function runOpenCvAnalysis(
  canvas: HTMLCanvasElement,
  params: AnalysisParams,
  onProgress: (p: number) => void
): { cells: DetectedCell[]; rbc: number; wbc: number; plt: number } {
  const cv = window.cv;
  if (!cv || !cv.Mat) {
    throw new Error('OpenCV.js not initialized');
  }

  onProgress(10);
  const src = cv.imread(canvas);
  const ppu = getPixelsPerUm(params.mag);

  // HSV transformation for color classification
  const hsv = new cv.Mat();
  cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  onProgress(30);

  // Extract gray scale for morphology
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Apply adaptive contrast enhancement (CLAHE) safely
  const enh = new cv.Mat();
  if (cv.CLAHE) {
    try {
      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      clahe.apply(gray, enh);
      clahe.delete();
    } catch (e) {
      console.warn('CLAHE failed, falling back to equalizeHist', e);
      cv.equalizeHist(gray, enh);
    }
  } else if (cv.equalizeHist) {
    cv.equalizeHist(gray, enh);
  } else {
    gray.copyTo(enh);
  }

  // Subtract background using top-hat morphology to normalize illumination
  const bk = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(51, 51));
  const bg = new cv.Mat();
  cv.morphologyEx(enh, bg, cv.MORPH_OPEN, bk);
  const bgSub = new cv.Mat();
  cv.subtract(enh, bg, bgSub);
  cv.threshold(bgSub, bgSub, 0, 255, cv.THRESH_TOZERO);

  onProgress(50);

  // Gaussian blur & threshold
  const blur = new cv.Mat();
  cv.GaussianBlur(bgSub, blur, new cv.Size(params.blur, params.blur), 0, 0, cv.BORDER_DEFAULT);
  const thr = new cv.Mat();
  cv.threshold(blur, thr, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

  // Clean noise
  const sk = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const cm = new cv.Mat();
  cv.morphologyEx(thr, cm, cv.MORPH_CLOSE, sk, new cv.Point(-1, -1), 2);
  cv.morphologyEx(cm, cm, cv.MORPH_OPEN, sk, new cv.Point(-1, -1), 1);

  onProgress(70);

  // Robust findContours extraction
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(cm, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  onProgress(85);

  const cells: DetectedCell[] = [];
  let rbcCount = 0;
  let wbcCount = 0;
  let pltCount = 0;
  let cellIdCounter = 1;

  const W = src.cols;
  const H = src.rows;

  for (let i = 0; i < contours.size(); ++i) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if (area < params.minSize || area > params.maxArea) {
      contour.delete();
      continue;
    }

    const rect = cv.boundingRect(contour);
    const bw = rect.width;
    const bh = rect.height;
    const bArea = bw * bh;
    const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));

    // Calculate centroid from moments
    const M = cv.moments(contour);
    let cx = rect.x + bw / 2;
    let cy = rect.y + bh / 2;
    if (M.m00 !== 0) {
      cx = M.m10 / M.m00;
      cy = M.m01 / M.m00;
    }

    // Convex hull for circularity
    const hull = new cv.Mat();
    cv.convexHull(contour, hull, false, true);
    const perim = cv.arcLength(hull, true);
    const circularity = perim > 0 ? (4 * Math.PI * area) / (perim * perim) : 0;
    const solidity = area / bArea;

    hull.delete();

    // Query HSV of center pixel
    const cyi = Math.min(Math.max(0, Math.round(cy)), H - 1);
    const cxi = Math.min(Math.max(0, Math.round(cx)), W - 1);
    const hsvIdx = (cyi * W + cxi) * 3;
    const hue = hsv.data[hsvIdx];
    const sat = hsv.data[hsvIdx + 1];

    const areaUm2 = area / (ppu * ppu);
    const diameter = 2 * Math.sqrt(areaUm2 / Math.PI);

    let type: CellType = 'rbc';
    const isStained = params.imgType === 'stained';

    const isPlatelet = areaUm2 < 7.5;
    const isWbc = (isStained && hue >= 100 && hue <= 180 && sat > 25 && areaUm2 > 45) ||
                  (!isStained && areaUm2 > 85) ||
                  (areaUm2 > 110 && circularity < 0.72);

    if (isPlatelet) {
      type = 'platelet';
      pltCount++;
    } else if (isWbc) {
      type = 'wbc';
      wbcCount++;
    } else {
      type = 'rbc';
      rbcCount++;
    }

    cells.push({
      id: `c_${cellIdCounter++}`,
      type,
      area,
      aum: parseFloat(areaUm2.toFixed(2)),
      dia: parseFloat(diameter.toFixed(2)),
      circ: parseFloat(Math.min(1.0, Math.max(0.01, circularity)).toFixed(3)),
      sol: parseFloat(Math.min(1.0, Math.max(0.01, solidity)).toFixed(3)),
      hue,
      sat,
      cx: Math.round(cx),
      cy: Math.round(cy),
      bw,
      bh,
      ar: parseFloat(aspect.toFixed(2)),
    });

    contour.delete();
  }

  // Draw overlay on canvas
  const output = src.clone();
  cells.forEach(cell => {
    let color;
    if (cell.type === 'rbc') {
      color = [34, 197, 94, 255]; // green-500
    } else if (cell.type === 'wbc') {
      color = [239, 68, 68, 255]; // red-500
    } else {
      color = [234, 179, 8, 255]; // yellow-500
    }

    cv.rectangle(output, new cv.Point(cell.cx - cell.bw/2, cell.cy - cell.bh/2), new cv.Point(cell.cx + cell.bw/2, cell.cy + cell.bh/2), color, 2);
    const labelText = cell.type === 'rbc' ? 'R' : cell.type === 'wbc' ? 'W' : 'P';
    cv.putText(output, labelText, new cv.Point(cell.cx - cell.bw/2 + 2, cell.cy - cell.bh/2 - 4), cv.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv.LINE_AA);
  });

  cv.imshow(canvas, output);

  // Clean memory
  src.delete();
  hsv.delete();
  gray.delete();
  enh.delete();
  bk.delete();
  bg.delete();
  bgSub.delete();
  blur.delete();
  thr.delete();
  sk.delete();
  cm.delete();
  contours.delete();
  hierarchy.delete();
  output.delete();

  onProgress(100);

  return {
    cells,
    rbc: rbcCount,
    wbc: wbcCount,
    plt: pltCount,
  };
}
