import { AnalysisParams } from '../types';

/**
 * Dynamically generates a high-quality simulated blood smear or hemocytometer microscope image
 * directly inside an HTML canvas. This provides immediate, realistic data for users to test.
 */
export function generateSampleMicroscopeImage(
  type: 'stained' | 'unstained' | 'hemocytometer',
  density: 'normal' | 'anemia' | 'leukocytosis' | 'thrombocytopenia' = 'normal'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // 1. Set Background
  if (type === 'stained') {
    // Elegant warm light-pink / lavender background of a Giemsa stained blood smear slide
    ctx.fillStyle = '#f9f3eb';
    ctx.fillRect(0, 0, 800, 600);

    // Subtle background illumination gradient (vignetting and lens artifacts)
    const grad = ctx.createRadialGradient(400, 300, 50, 400, 300, 500);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(1, 'rgba(235, 222, 210, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
  } else if (type === 'unstained') {
    // Pale translucent grey/greenish liquid suspension
    ctx.fillStyle = '#eaf0f2';
    ctx.fillRect(0, 0, 800, 600);
    const grad = ctx.createRadialGradient(400, 300, 100, 400, 300, 500);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(200, 210, 215, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
  } else {
    // Hemocytometer
    // Metallic pale-blue/gray reflective grid surface
    ctx.fillStyle = '#d3dfdf';
    ctx.fillRect(0, 0, 800, 600);

    // Draw the Hemocytometer Grid lines (Neubauer ruling)
    ctx.strokeStyle = 'rgba(26, 43, 62, 0.25)';
    ctx.lineWidth = 1.5;

    // Grid center lines
    for (let i = 0; i <= 10; i++) {
      const pos = 100 + i * 60;
      // Verticals
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 600);
      ctx.stroke();

      // Horizontals
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(800, pos);
      ctx.stroke();

      // Draw triple boundary lines for Neubauer counting areas
      if (i === 1 || i === 5 || i === 9) {
        ctx.strokeStyle = 'rgba(26, 43, 62, 0.4)';
        ctx.lineWidth = 2.5;
        // Draw triple line offset
        ctx.beginPath();
        ctx.moveTo(pos - 4, 0); ctx.lineTo(pos - 4, 600);
        ctx.moveTo(pos + 4, 0); ctx.lineTo(pos + 4, 600);
        ctx.moveTo(0, pos - 4); ctx.lineTo(800, pos - 4);
        ctx.moveTo(0, pos + 4); ctx.lineTo(800, pos + 4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(26, 43, 62, 0.25)';
        ctx.lineWidth = 1.5;
      }
    }
  }

  // 2. Adjust counts based on clinical scenarios (densities)
  let rbcCount = 180;
  let wbcCount = 4;
  let pltCount = 20;

  if (density === 'anemia') {
    rbcCount = 65;
    wbcCount = 3;
    pltCount = 15;
  } else if (density === 'leukocytosis') {
    rbcCount = 160;
    wbcCount = 18; // Massive leukocyte increase
    pltCount = 25;
  } else if (density === 'thrombocytopenia') {
    rbcCount = 190;
    wbcCount = 4;
    pltCount = 2; // Platelet deficiency
  }

  // Helper to ensure cells don't spawn completely overlapping on center coordinates
  const spawnPoints: { x: number; y: number; r: number }[] = [];
  function isTooOverlaid(x: number, y: number, r: number, minOverlapDist = 0.5): boolean {
    for (const pt of spawnPoints) {
      const dist = Math.hypot(pt.x - x, pt.y - y);
      const minDist = (pt.r + r) * minOverlapDist;
      if (dist < minDist) return true;
    }
    return false;
  }

  // Draw WBCs first (they are larger and in the foreground)
  const actualWbcs = Math.max(1, wbcCount);
  for (let i = 0; i < actualWbcs; i++) {
    let x = 0, y = 0;
    const r = 24 + Math.random() * 8; // large cell size

    let attempts = 0;
    do {
      x = 50 + Math.random() * 700;
      y = 50 + Math.random() * 500;
      attempts++;
    } while (isTooOverlaid(x, y, r, 0.7) && attempts < 100);

    spawnPoints.push({ x, y, r });

    if (type === 'stained') {
      // Beautiful stained Leukocyte (Neutrophil / Lymphocyte / Monocyte)
      const isLymphocyte = Math.random() > 0.6;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(147, 112, 219, 0.6)'; // violet cytoplasm
      ctx.fill();
      ctx.strokeStyle = '#5d3f8a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nucleus (Dark multi-lobed or single large round)
      ctx.fillStyle = '#3a1f5d'; // dark purple nucleus
      if (isLymphocyte) {
        // Large eccentric nucleus covering 75% of cell
        ctx.beginPath();
        ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.75, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Lobed Nucleus (3-4 segmented lobes)
        const numLobes = 3 + Math.floor(Math.random() * 2);
        for (let j = 0; j < numLobes; j++) {
          const angle = (j * 2 * Math.PI) / numLobes;
          const lx = x + Math.cos(angle) * (r * 0.4);
          const ly = y + Math.sin(angle) * (r * 0.4);
          ctx.beginPath();
          ctx.arc(lx, ly, r * 0.35, 0, 2 * Math.PI);
          ctx.fill();

          // Connective nuclear filament
          if (j > 0) {
            const prevAngle = ((j - 1) * 2 * Math.PI) / numLobes;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(x + Math.cos(prevAngle) * (r * 0.4), y + Math.sin(prevAngle) * (r * 0.4));
            ctx.strokeStyle = '#3a1f5d';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
        }
      }
    } else {
      // Unstained WBC: Pale, high refraction, circular with textured grain
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(240, 245, 248, 0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 115, 125, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Refractive inner grain/nucleus shadow
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(80, 100, 110, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Draw RBCs (Red Blood Cells)
  for (let i = 0; i < rbcCount; i++) {
    let x = 0, y = 0;
    const r = 13 + Math.random() * 3.5; // typical size of erythrocytes

    let attempts = 0;
    do {
      x = 30 + Math.random() * 740;
      y = 30 + Math.random() * 540;
      attempts++;
    } while (isTooOverlaid(x, y, r, 0.45) && attempts < 50);

    spawnPoints.push({ x, y, r });

    if (type === 'stained') {
      // Giemsa stained RBC: salmon-pink with classic lighter central pallor
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, '#fbe6e3'); // lighter pallor
      grad.addColorStop(0.35, '#f7cdca');
      grad.addColorStop(1, '#db706a');  // darker periphery
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#c0524d';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Unstained RBC: Double-contoured, grayish-translucent refractive ring
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(235, 240, 242, 0.4)';
      ctx.fill();

      // Outer refraction ring
      ctx.strokeStyle = 'rgba(110, 130, 140, 0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner central pallor circle
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(160, 180, 190, 0.4)';
      ctx.stroke();
    }
  }

  // Draw Platelets (small thrombocytes)
  for (let i = 0; i < pltCount; i++) {
    let x = 0, y = 0;
    const r = 3 + Math.random() * 2.5; // very small size

    let attempts = 0;
    do {
      x = 20 + Math.random() * 760;
      y = 20 + Math.random() * 560;
      attempts++;
    } while (isTooOverlaid(x, y, r, 0.15) && attempts < 50);

    spawnPoints.push({ x, y, r });

    if (type === 'stained') {
      // Stained platelets: small purple/red starry granules with irregular shapes
      ctx.fillStyle = '#673ab7'; // deep purple/violet
      ctx.beginPath();
      // Draw as star-like or jagged shape
      for (let j = 0; j < 5; j++) {
        const rot = (Math.PI / 2) * 3;
        let cx = x;
        let cy = y;
        const step = Math.PI / 5;

        ctx.moveTo(x, y - r);
        for (let k = 0; k < 5; k++) {
          cx = x + Math.cos(rot + k * step * 2) * r;
          cy = y + Math.sin(rot + k * step * 2) * r;
          ctx.lineTo(cx, cy);
          cx = x + Math.cos(rot + (k * 2 + 1) * step) * (r * 0.5);
          cy = y + Math.sin(rot + (k * 2 + 1) * step) * (r * 0.5);
          ctx.lineTo(cx, cy);
        }
        ctx.closePath();
      }
      ctx.fill();
    } else {
      // Unstained platelets: tiny high-contrast refracting dust dots
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(90, 110, 120, 0.85)';
      ctx.fill();
    }
  }

  return canvas.toDataURL('image/png');
}
