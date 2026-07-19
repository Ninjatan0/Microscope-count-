import React, { useRef, useState, useEffect } from 'react';
import { AnalysisParams, DetectedCell, CellType } from '../types';
import { runFallbackAnalysis, runOpenCvAnalysis } from '../utils/imageProcessing';
import { Play, RotateCcw, Save, Download, FileSpreadsheet, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

interface AnalysisTabProps {
  currentImgUrl: string | null;
  cvReady: boolean;
  onAnalysisComplete: (result: {
    cells: DetectedCell[];
    rbc: number;
    wbc: number;
    plt: number;
    params: AnalysisParams;
    processedImgUrl: string;
  }) => void;
  onSaveRecord: () => void;
  canSave: boolean;
}

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  currentImgUrl,
  cvReady,
  onAnalysisComplete,
  onSaveRecord,
  canSave,
}) => {
  // Parameters
  const [params, setParams] = useState<AnalysisParams>({
    mag: 40,
    imgType: 'stained',
    smp: 'smear',
    dilution: 1,
    minSize: 80,
    circularity: 0.5,
    maxArea: 15000,
    blur: 5,
  });

  const [activeTool, setActiveTool] = useState<'inspect' | 'add_rbc' | 'add_wbc' | 'add_plt' | 'erase'>('inspect');
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Stats
  const [detectedCells, setDetectedCells] = useState<DetectedCell[]>([]);
  const [rbcCount, setRbcCount] = useState<number>(0);
  const [wbcCount, setWbcCount] = useState<number>(0);
  const [pltCount, setPltCount] = useState<number>(0);

  // References
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Load and fit image to canvas
  useEffect(() => {
    if (!currentImgUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = sourceCanvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!canvas || !overlay) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Bound size
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const maxDim = 1000;
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // Match overlay
      overlay.width = w;
      overlay.height = h;

      // Clear detected cells on new image load
      setDetectedCells([]);
      setRbcCount(0);
      setWbcCount(0);
      setPltCount(0);
      drawOverlay();
    };
    img.src = currentImgUrl;
  }, [currentImgUrl]);

  // Redraw overlays when cells, tool or hovers change
  useEffect(() => {
    drawOverlay();
  }, [detectedCells, hoveredCellId, activeTool, showOverlay]);

  const drawOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showOverlay) return;

    detectedCells.forEach((cell) => {
      const isHovered = cell.id === hoveredCellId;
      ctx.lineWidth = isHovered ? 4 : 2;

      let strokeStyle = '#22c55e';
      let fillStyle = 'rgba(34, 197, 94, 0.08)';

      if (cell.type === 'wbc') {
        strokeStyle = '#ef4444';
        fillStyle = 'rgba(239, 68, 68, 0.08)';
      } else if (cell.type === 'platelet') {
        strokeStyle = '#eab308';
        fillStyle = 'rgba(234, 179, 8, 0.08)';
      }

      ctx.strokeStyle = strokeStyle;
      ctx.fillStyle = fillStyle;

      // Draw bounding box
      const rx = cell.cx - cell.bw / 2;
      const ry = cell.cy - cell.bh / 2;
      ctx.strokeRect(rx, ry, cell.bw, cell.bh);
      ctx.fillRect(rx, ry, cell.bw, cell.bh);

      if (isHovered) {
        // Double-ring highlight
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx - 2, ry - 2, cell.bw + 4, cell.bh + 4);
      }

      // Draw dynamic labels
      ctx.fillStyle = strokeStyle;
      ctx.font = 'bold 10px Inter, sans-serif';
      const indicator = cell.type === 'rbc' ? 'RBC' : cell.type === 'wbc' ? 'WBC' : 'PLT';
      const labelW = ctx.measureText(indicator).width + 6;

      ctx.fillRect(rx, ry - 14, labelW, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(indicator, rx + 3, ry - 3);
    });
  };

  const executeAnalysis = () => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    setProcessing(true);
    setProgress(10);

    setTimeout(() => {
      try {
        let results;
        // Make a clone of canvas for processing
        const workCanvas = document.createElement('canvas');
        workCanvas.width = canvas.width;
        workCanvas.height = canvas.height;
        const workCtx = workCanvas.getContext('2d')!;
        workCtx.drawImage(canvas, 0, 0);

        if (cvReady) {
          results = runOpenCvAnalysis(workCanvas, params, setProgress);
        } else {
          results = runFallbackAnalysis(workCanvas, params, setProgress);
        }

        setDetectedCells(results.cells);
        setRbcCount(results.rbc);
        setWbcCount(results.wbc);
        setPltCount(results.plt);

        onAnalysisComplete({
          cells: results.cells,
          rbc: results.rbc,
          wbc: results.wbc,
          plt: results.plt,
          params,
          processedImgUrl: workCanvas.toDataURL('image/png'),
        });

        showToast(`Analyzed: ${results.cells.length} cells successfully.`);
      } catch (err: any) {
        console.error(err);
        showToast(`Analysis Error: ${err.message}`);
      } finally {
        setProcessing(false);
      }
    }, 100);
  };

  // Click on Canvas handles Manual Corrections & Interaction
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);

    if (activeTool === 'erase') {
      // Find closest cell inside radius
      const target = detectedCells.find((c) => {
        const dist = Math.hypot(c.cx - x, c.cy - y);
        return dist < Math.max(c.bw, c.bh, 15);
      });

      if (target) {
        const newList = detectedCells.filter((c) => c.id !== target.id);
        setDetectedCells(newList);
        // Adjust counts
        if (target.type === 'rbc') setRbcCount(prev => prev - 1);
        else if (target.type === 'wbc') setWbcCount(prev => prev - 1);
        else setPltCount(prev => prev - 1);
        showToast(`Erased a ${target.type.toUpperCase()}`);
      }
    } else if (activeTool !== 'inspect') {
      // Add cell manually
      let cellType: CellType = 'rbc';
      let size = 30; // standard RBC diameter px at 40x
      if (activeTool === 'add_wbc') {
        cellType = 'wbc';
        size = 60;
      } else if (activeTool === 'add_plt') {
        cellType = 'platelet';
        size = 12;
      }

      const ppu = 4; // standard fall back
      const areaUm2 = (size * size) / (ppu * ppu);
      const diameter = 2 * Math.sqrt(areaUm2 / Math.PI);

      const newCell: DetectedCell = {
        id: `man_${Date.now()}`,
        type: cellType,
        area: size * size,
        aum: parseFloat(areaUm2.toFixed(2)),
        dia: parseFloat(diameter.toFixed(2)),
        circ: 0.95,
        sol: 0.95,
        hue: cellType === 'wbc' ? 260 : 0,
        sat: cellType === 'wbc' ? 40 : 0,
        cx: x,
        cy: y,
        bw: size,
        bh: size,
        ar: 1.0,
        manuallyAdded: true,
      };

      setDetectedCells((prev) => [...prev, newCell]);
      if (cellType === 'rbc') setRbcCount(p => p + 1);
      else if (cellType === 'wbc') setWbcCount(p => p + 1);
      else setPltCount(p => p + 1);

      showToast(`Manually added ${cellType.toUpperCase()}`);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'inspect') {
      setHoveredCellId(null);
      return;
    }

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);

    // Find if hovering inside cell box
    const found = detectedCells.find((c) => {
      const rx = c.cx - c.bw / 2;
      const ry = c.cy - c.bh / 2;
      return x >= rx && x <= rx + c.bw && y >= ry && y <= ry + c.bh;
    });

    setHoveredCellId(found ? found.id : null);
  };

  // WBC Differential calculations
  const calculateDifferential = () => {
    const wbcs = detectedCells.filter((c) => c.type === 'wbc');
    const totalWbc = wbcs.length;
    if (totalWbc === 0) return { n: 0, l: 0, m: 0, e: 0, b: 0 };

    let n = 0, l = 0, m = 0, e = 0, b = 0;
    wbcs.forEach((c) => {
      // Clinical approximation rules based on cell size and optical traits
      if (c.dia >= 12 && c.dia <= 16 && c.circ < 0.78) n++;
      else if (c.dia >= 7 && c.dia <= 12 && c.circ >= 0.78) l++;
      else if (c.dia > 15) m++;
      else if (c.hue <= 20 && c.sat > 45) e++;
      else if (c.hue >= 140 && c.sat > 35) b++;
      else n++;
    });

    return {
      n: Math.round((n / totalWbc) * 100),
      l: Math.round((l / totalWbc) * 100),
      m: Math.round((m / totalWbc) * 100),
      e: Math.round((e / totalWbc) * 100),
      b: Math.round((b / totalWbc) * 100),
    };
  };

  const diff = calculateDifferential();

  // Concentration text
  const getConcentrationText = () => {
    if (params.smp === 'hemocytometer') {
      const tot = rbcCount + wbcCount;
      const cellsPerMl = Math.round((tot / 4) * params.dilution * 10000);
      return `${cellsPerMl.toLocaleString()} cells/mL`;
    } else {
      // Estimate absolute count per uL for a typical 40x high-power field (HPF)
      const fovArea = Math.PI * Math.pow(250, 2); // 250 um radius field
      const rbcUl = Math.round((rbcCount / fovArea) * 1e6 * params.dilution);
      const wbcUl = Math.round((wbcCount / fovArea) * 1e6 * params.dilution);
      return `RBC: ${rbcUl.toLocaleString()}/μL  |  WBC: ${wbcUl.toLocaleString()}/μL`;
    }
  };

  return (
    <div id="analysis-tab-content" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-[#121214] border border-white/10 px-4 py-3 text-sm font-semibold text-[#E4E4E7] shadow-xl animate-bounce">
          <span className="h-2 w-2 rounded-full bg-indigo-400" />
          {toastMsg}
        </div>
      )}

      {/* LEFT COLUMN: Controls & Parameters */}
      <div className="lg:col-span-4 space-y-5">
        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
          <h3 className="text-sm font-semibold text-white">1. Image Input Source</h3>
          <p className="text-[11px] text-[#A1A1AA] mt-1 leading-relaxed">
            Upload an image from a biological sample slide or select one from the quick test gallery below.
          </p>

          {!currentImgUrl && (
            <div className="mt-4 flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-[#0F0F12] p-4 text-center">
              <span className="text-xs text-[#71717A]">No image loaded yet</span>
              <p className="text-[10px] text-[#52525B] max-w-[200px] mt-1">
                Choose a sample image from the test gallery or click standard upload.
              </p>
            </div>
          )}

          {currentImgUrl && (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/5 bg-[#18181B] relative group">
              <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                <canvas ref={sourceCanvasRef} className="max-h-full max-w-full object-contain hidden" />
                <img
                  src={currentImgUrl}
                  alt="Source Thumbnail"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain opacity-85"
                />
              </div>
              <div className="p-2.5 bg-[#1C1C20] flex items-center justify-between text-[11px] text-zinc-300">
                <span className="font-semibold text-indigo-400">Slide Active</span>
                <span className="text-[10px] text-[#71717A]">Adaptive Size</span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Image Sliders Parameters */}
        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-sm font-semibold text-white">2. Segmentation Parameters</h3>
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-400 border border-indigo-500/20 uppercase">
              Tuning
            </span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-[11px] font-medium text-[#A1A1AA] mb-1.5">
                <span>Min Cell Area (pixels)</span>
                <span className="font-mono text-indigo-400 font-bold">{params.minSize}px</span>
              </div>
              <input
                id="param-min-size"
                type="range"
                min="10"
                max="500"
                value={params.minSize}
                onChange={(e) => setParams(prev => ({ ...prev, minSize: parseInt(e.target.value) }))}
                className="w-full accent-indigo-500 bg-zinc-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-[#A1A1AA] mb-1.5">
                <span>Max Cell Area (pixels)</span>
                <span className="font-mono text-indigo-400 font-bold">{params.maxArea.toLocaleString()}px</span>
              </div>
              <input
                id="param-max-area"
                type="range"
                min="1000"
                max="80000"
                step="500"
                value={params.maxArea}
                onChange={(e) => setParams(prev => ({ ...prev, maxArea: parseInt(e.target.value) }))}
                className="w-full accent-indigo-500 bg-zinc-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-[#A1A1AA] mb-1.5">
                <span>Gaussian Smoothing (Blur K-size)</span>
                <span className="font-mono text-indigo-400 font-bold">{params.blur}px</span>
              </div>
              <input
                id="param-blur"
                type="range"
                min="3"
                max="15"
                step="2"
                value={params.blur}
                onChange={(e) => setParams(prev => ({ ...prev, blur: parseInt(e.target.value) }))}
                className="w-full accent-indigo-500 bg-zinc-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-[#A1A1AA] mb-1.5">
                <span>Optical Dilution Factor</span>
                <span className="font-mono text-indigo-400 font-bold">{params.dilution}x</span>
              </div>
              <input
                id="param-dilution"
                type="number"
                min="1"
                max="99999"
                value={params.dilution}
                onChange={(e) => setParams(prev => ({ ...prev, dilution: Math.max(1, parseFloat(e.target.value) || 1) }))}
                className="w-full rounded-lg bg-[#18181B] border border-white/5 text-white px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Viewer + Results */}
      <div className="lg:col-span-8 space-y-6">
        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">3. Interactive Cell Counter Display</h3>
              <p className="text-[11px] text-[#A1A1AA]">Left click on cells to manually adjust annotations.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-toggle-overlay"
                onClick={() => setShowOverlay(!showOverlay)}
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-[#D4D4D8] transition hover:bg-[#202024] hover:text-white"
              >
                {showOverlay ? <EyeOff size={13} /> : <Eye size={13} />}
                {showOverlay ? 'Hide Labels' : 'Show Labels'}
              </button>

              <button
                id="btn-process-count"
                onClick={executeAnalysis}
                disabled={processing || !currentImgUrl}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/10 transition disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <Play size={14} className={processing ? 'animate-spin' : ''} />
                {processing ? 'Processing...' : 'Run Auto Count'}
              </button>
            </div>
          </div>

          {processing && (
            <div className="mt-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 p-3.5 flex items-center gap-4">
              <div className="h-2 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-bold text-indigo-400">{progress}%</span>
            </div>
          )}

          {/* Interactive Work Area */}
          <div className="mt-4 relative rounded-xl border border-white/5 bg-[#0C0C0E] overflow-hidden min-h-[350px] flex items-center justify-center">
            {currentImgUrl ? (
              <div ref={containerRef} className="relative max-h-[500px] max-w-full">
                {/* Background image source (loaded via standard component to handle lifecycle) */}
                <img
                  src={currentImgUrl}
                  alt="Microscope Slide Workspace"
                  referrerPolicy="no-referrer"
                  className="max-h-[500px] max-w-full object-contain select-none pointer-events-none block"
                />
                {/* Overlay Interactive Canvas */}
                <canvas
                  id="overlay-canvas"
                  ref={overlayCanvasRef}
                  onMouseMove={handleMouseMove}
                  onClick={handleCanvasClick}
                  className="absolute top-0 left-0 w-full h-full cursor-crosshair z-10"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <span className="text-xs text-[#71717A] font-semibold uppercase tracking-wider">No Slide Loaded</span>
                <p className="text-[10px] text-[#52525B] max-w-xs mt-1.5">
                  Select a cell sample below or click standard slide file uploads to test.
                </p>
              </div>
            )}
          </div>

          {/* Interactive Annotation Tools Bar */}
          {currentImgUrl && (
            <div className="mt-4 rounded-xl bg-[#18181B] p-3 flex flex-wrap items-center justify-between gap-3 border border-white/5">
              <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Manual Correction Tools:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  id="tool-inspect"
                  onClick={() => setActiveTool('inspect')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTool === 'inspect' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-[#121214] text-[#A1A1AA] hover:bg-[#1C1C20] hover:text-white border border-white/5'
                  }`}
                >
                  Hover Inspect
                </button>
                <button
                  id="tool-add-rbc"
                  onClick={() => setActiveTool('add_rbc')}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTool === 'add_rbc' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[#121214] text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20'
                  }`}
                >
                  <Plus size={12} /> RBC
                </button>
                <button
                  id="tool-add-wbc"
                  onClick={() => setActiveTool('add_wbc')}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTool === 'add_wbc' ? 'bg-rose-600 text-white shadow-sm' : 'bg-[#121214] text-rose-400 hover:bg-rose-500/10 border border-rose-500/20'
                  }`}
                >
                  <Plus size={12} /> WBC
                </button>
                <button
                  id="tool-add-plt"
                  onClick={() => setActiveTool('add_plt')}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTool === 'add_plt' ? 'bg-amber-600 text-white shadow-sm' : 'bg-[#121214] text-amber-400 hover:bg-amber-500/10 border border-amber-500/20'
                  }`}
                >
                  <Plus size={12} /> Platelet
                </button>
                <button
                  id="tool-erase"
                  onClick={() => setActiveTool('erase')}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTool === 'erase' ? 'bg-zinc-600 text-white shadow-sm' : 'bg-[#121214] text-[#A1A1AA] hover:bg-[#1C1C20] border border-white/5'
                  }`}
                >
                  <Trash2 size={12} /> Erase
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RESULTS METRICS */}
        {detectedCells.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
            {/* Quick Summary Counts Card */}
            <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Analysis Quantities</h3>
                <p className="text-[11px] text-[#A1A1AA]">Direct morphological segment counts.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3 text-center">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">RBC</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">{rbcCount}</div>
                </div>
                <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-center">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">WBC</span>
                  <div className="text-2xl font-black text-rose-400 mt-1">{wbcCount}</div>
                </div>
                <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 text-center">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Platelet</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">{pltCount}</div>
                </div>
              </div>

              <div className="rounded-xl bg-[#18181B] p-3 flex items-center justify-between text-xs font-semibold text-[#D4D4D8] border border-white/5">
                <span>Concentration Density</span>
                <span className="text-indigo-400 font-mono">{getConcentrationText()}</span>
              </div>

              <button
                id="btn-save-record-analysistab"
                onClick={onSaveRecord}
                disabled={!canSave}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/15 transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={13} /> Save Current to Database
              </button>
            </div>

            {/* WBC Differential Card */}
            <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
              <h3 className="text-sm font-semibold text-white">WBC Differential Breakdown</h3>
              <p className="text-[11px] text-[#A1A1AA] mt-0.5">Estimated leukocyte classifications.</p>

              {wbcCount === 0 ? (
                <div className="h-44 flex items-center justify-center text-center">
                  <span className="text-xs text-[#71717A]">No White Blood Cells detected for differential</span>
                </div>
              ) : (
                <div className="mt-4 space-y-3.5">
                  {[
                    { name: 'Neutrophils', val: diff.n, ref: '40-70%' },
                    { name: 'Lymphocytes', val: diff.l, ref: '20-40%' },
                    { name: 'Monocytes', val: diff.m, ref: '2-8%' },
                    { name: 'Eosinophils', val: diff.e, ref: '1-4%' },
                    { name: 'Basophils', val: diff.b, ref: '0-1%' },
                  ].map((row, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-medium text-[#A1A1AA]">
                        <span className="font-bold text-[#E4E4E7]">{row.name}</span>
                        <div className="flex gap-2">
                          <span className="font-semibold text-indigo-400">{row.val}%</span>
                          <span className="text-zinc-500">Ref: {row.ref}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-zinc-800/40 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${row.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
