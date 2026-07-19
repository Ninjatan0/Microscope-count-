import React, { useState, useEffect } from 'react';
import { AnalysisTab } from './components/AnalysisTab';
import { RecordsTab } from './components/RecordsTab';
import { ReportTab } from './components/ReportTab';
import { SampleGallery } from './components/SampleGallery';
import { AnalysisRecord, DetectedCell, AnalysisParams } from './types';
import { Microscope, Database, FileText, Upload, Camera, HelpCircle, Activity, Info } from 'lucide-react';
import { generateSampleMicroscopeImage } from './utils/sampleGenerator';

export default function App() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'records' | 'report'>('analysis');
  const [cvReady, setCvReady] = useState<boolean>(false);
  const [cvLoadingStatus, setCvLoadingStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  // Slide Images State
  const [currentImgUrl, setCurrentImgUrl] = useState<string | null>(null);

  // History/Database records State
  const [records, setRecords] = useState<AnalysisRecord[]>([]);

  // Current analysis output placeholder
  const [latestAnalysis, setLatestAnalysis] = useState<{
    cells: DetectedCell[];
    rbc: number;
    wbc: number;
    plt: number;
    params: AnalysisParams;
    processedImgUrl: string;
  } | null>(null);

  // Load records on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('microscope_cell_records');
      if (stored) {
        setRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }

    // Default load a normal stained blood smear as initial demo
    const initialDemoUrl = generateSampleMicroscopeImage('stained', 'normal');
    setCurrentImgUrl(initialDemoUrl);
  }, []);

  // Dynamically load OpenCV.js with fallback timer
  useEffect(() => {
    let fallbackTimeout: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    // Check if window.cv is already loaded (perhaps in a hot-reload state)
    if (window.cv && window.cv.Mat) {
      setCvReady(true);
      setCvLoadingStatus('ready');
    } else {
      // Check if the script is already present in the document to avoid duplicate registration of bindings
      const existingScript = document.querySelector('script[src*="opencv.js"]');
      
      const pollWasm = () => {
        let attempts = 0;
        interval = setInterval(() => {
          if (window.cv && window.cv.Mat) {
            clearInterval(interval);
            clearTimeout(fallbackTimeout);
            setCvReady(true);
            setCvLoadingStatus('ready');
          } else if (++attempts > 150) { // 30 seconds
            clearInterval(interval);
            setCvLoadingStatus('fallback');
          }
        }, 200);
      };

      if (existingScript) {
        pollWasm();
      } else {
        // Start dynamic script injection
        const script = document.createElement('script');
        script.src = 'https://docs.opencv.org/4.x/opencv.js';
        script.async = true;

        script.onload = () => {
          pollWasm();
        };

        script.onerror = () => {
          setCvLoadingStatus('fallback');
        };

        document.body.appendChild(script);

        // Trigger fallback mode if CDN loads too slowly (prevent blocking user experience)
        fallbackTimeout = setTimeout(() => {
          setCvLoadingStatus('fallback');
        }, 7000); // 7s grace period before fallback is recommended
      }
    }

    return () => {
      clearTimeout(fallbackTimeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  // Select Sample from test gallery
  const handleSelectSample = (dataUrl: string, type: string, scenario: string) => {
    setCurrentImgUrl(dataUrl);
    setLatestAnalysis(null); // Clear previous output when loading a new slide
  };

  // Upload custom file slide
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setCurrentImgUrl(ev.target.result as string);
        setLatestAnalysis(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Record
  const handleSaveRecord = () => {
    if (!latestAnalysis || !currentImgUrl) return;

    const date = new Date();
    // Compute concentration and per uL density
    const p = latestAnalysis.params;
    let rbcUl = 0;
    let wbcUl = 0;
    let conc = '';

    if (p.smp === 'hemocytometer') {
      const tot = latestAnalysis.rbc + latestAnalysis.wbc;
      const cellsPerMl = Math.round((tot / 4) * p.dilution * 10000);
      conc = `${cellsPerMl.toLocaleString()} cells/mL`;
    } else {
      const fovArea = Math.PI * Math.pow(250, 2);
      rbcUl = Math.round((latestAnalysis.rbc / fovArea) * 1e6 * p.dilution);
      wbcUl = Math.round((latestAnalysis.wbc / fovArea) * 1e6 * p.dilution);
      conc = `RBC: ${rbcUl.toLocaleString()}/μL  |  WBC: ${wbcUl.toLocaleString()}/μL`;
    }

    // Compute differential
    const wbcs = latestAnalysis.cells.filter(c => c.type === 'wbc');
    const totalWbc = wbcs.length;
    let n = 0, l = 0, m = 0, e = 0, b = 0;

    wbcs.forEach(c => {
      if (c.dia >= 12 && c.dia <= 16 && c.circ < 0.78) n++;
      else if (c.dia >= 7 && c.dia <= 12 && c.circ >= 0.78) l++;
      else if (c.dia > 15) m++;
      else if (c.hue <= 20 && c.sat > 45) e++;
      else if (c.hue >= 140 && c.sat > 35) b++;
      else n++;
    });

    const diff = totalWbc > 0 ? {
      n: Math.round((n / totalWbc) * 100),
      l: Math.round((l / totalWbc) * 100),
      m: Math.round((m / totalWbc) * 100),
      e: Math.round((e / totalWbc) * 100),
      b: Math.round((b / totalWbc) * 100),
    } : { n: 0, l: 0, m: 0, e: 0, b: 0 };

    const avgC = latestAnalysis.cells.length > 0
      ? (latestAnalysis.cells.reduce((s, c) => s + c.circ, 0) / latestAnalysis.cells.length).toFixed(3)
      : 'N/A';

    const avgD = latestAnalysis.cells.length > 0
      ? (latestAnalysis.cells.reduce((s, c) => s + c.dia, 0) / latestAnalysis.cells.length).toFixed(2)
      : 'N/A';

    const newRecord: AnalysisRecord = {
      id: `rec_${Date.now()}`,
      ts: date.toISOString(),
      params: p,
      rbc: latestAnalysis.rbc,
      wbc: latestAnalysis.wbc,
      plt: latestAnalysis.plt,
      total: latestAnalysis.rbc + latestAnalysis.wbc + latestAnalysis.plt,
      conc,
      rbcUl,
      wbcUl,
      diff,
      avgC,
      avgD,
      nObj: latestAnalysis.cells.length,
      cellData: latestAnalysis.cells,
      imgDataUrl: currentImgUrl,
      processedImgDataUrl: latestAnalysis.processedImgUrl,
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    try {
      localStorage.setItem('microscope_cell_records', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save to localStorage', err);
    }
  };

  const handleClearAllRecords = () => {
    if (window.confirm('Are you sure you want to clear the entire record history?')) {
      setRecords([]);
      localStorage.removeItem('microscope_cell_records');
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = 'ID,Timestamp,Mag,Sample,Dilution,RBC,WBC,PLT,Total,RBC_per_uL,WBC_per_uL,Neutro_pct,Lympho_pct,Mono_pct';
    const lines = records.map((r, i) => {
      const date = new Date(r.ts).toLocaleString().replace(/,/g, '');
      return `${i + 1},${date},${r.params.mag}x,${r.params.smp},${r.params.dilution},${r.rbc},${r.wbc},${r.plt},${r.total},${r.rbcUl},${r.wbcUl},${r.diff.n},${r.diff.l},${r.diff.m}`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...lines].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cell_records_database_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-[#0A0A0C] text-[#E4E4E7] font-sans antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-[#0C0C0E]/90 backdrop-blur-md border-b border-white/5 text-white shadow-sm">
        <div className="mx-auto max-w-7xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/25">
              <Microscope size={22} className="stroke-[2.25]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white uppercase">Microscope Cell Counter</h1>
              <p className="text-[11px] text-[#A1A1AA] font-medium">Automated Clinical Segment Counter & Analyzer</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* OpenCV.js State Badge */}
            <div className="flex items-center gap-2 rounded-full bg-[#18181B] px-3 py-1.5 border border-white/5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  cvLoadingStatus === 'ready'
                    ? 'bg-emerald-500'
                    : cvLoadingStatus === 'fallback'
                    ? 'bg-amber-500'
                    : 'bg-indigo-400 animate-pulse'
                }`}
              />
              <span className="text-[10px] font-semibold tracking-wider text-[#D4D4D8]">
                {cvLoadingStatus === 'ready'
                  ? 'OpenCV Active'
                  : cvLoadingStatus === 'fallback'
                  ? 'Canvas Engine'
                  : 'Booting OpenCV...'}
              </span>
            </div>

            {/* Standard Upload Slide Button */}
            <label className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white cursor-pointer transition-all shadow-md shadow-indigo-600/10 active:scale-95 duration-150">
              <Upload size={14} />
              <span>Upload Slide</span>
              <input
                id="file-upload-input"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 space-y-6">
        {/* Quick Sample Gallery (Lazy loaded assets) */}
        <SampleGallery onSelectSample={handleSelectSample} />

        {/* Tab Selection Row */}
        <div className="flex items-center gap-1 border border-white/5 bg-[#121214] p-1.5 rounded-xl shadow-inner">
          <button
            id="tab-analysis"
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'analysis'
                ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 shadow-sm'
                : 'text-[#A1A1AA] hover:text-white border border-transparent'
            }`}
          >
            <Microscope size={14} className="stroke-[2.25]" />
            <span>Cell Analyzer</span>
          </button>
          <button
            id="tab-records"
            onClick={() => setActiveTab('records')}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'records'
                ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 shadow-sm'
                : 'text-[#A1A1AA] hover:text-white border border-transparent'
            }`}
          >
            <Database size={14} className="stroke-[2.25]" />
            <span>Audit History ({records.length})</span>
          </button>
          <button
            id="tab-report"
            onClick={() => setActiveTab('report')}
            className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'report'
                ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 shadow-sm'
                : 'text-[#A1A1AA] hover:text-white border border-transparent'
            }`}
          >
            <FileText size={14} className="stroke-[2.25]" />
            <span>Clinical Sheet</span>
          </button>
        </div>

        {/* Informational Help Notice for Fallback vs OpenCV */}
        {cvLoadingStatus === 'fallback' && activeTab === 'analysis' && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-start gap-3 animate-fade-in">
            <Info className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div>
              <h4 className="text-xs font-bold text-amber-500">Ultra-fast Fallback Mode Activated</h4>
              <p className="text-[10px] text-amber-200/70 mt-1 leading-relaxed">
                OpenCV.js core took too long to compile or is unavailable. To guarantee a frictionless, zero-wait workspace, we loaded our custom client-side Canvas BFS segmentation engine. Results are fully responsive and calculated instantly!
              </p>
            </div>
          </div>
        )}

        {/* Tab Modules Content */}
        <div className="py-2">
          {activeTab === 'analysis' && (
            <AnalysisTab
              currentImgUrl={currentImgUrl}
              cvReady={cvReady}
              onAnalysisComplete={(res) => {
                setLatestAnalysis(res);
              }}
              onSaveRecord={handleSaveRecord}
              canSave={!!latestAnalysis}
            />
          )}

          {activeTab === 'records' && (
            <RecordsTab
              records={records}
              onClearAll={handleClearAllRecords}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === 'report' && (
            <ReportTab lastRecord={records[0] || null} />
          )}
        </div>
      </main>

      <footer className="bg-[#0C0C0E] border-t border-white/5 py-6 text-center text-xs text-[#52525B] mt-12 print:hidden">
        <div className="mx-auto max-w-7xl px-5">
          <p>© 2026 Microscope Cell Counter. Full Clinical Computer Vision Sandbox.</p>
        </div>
      </footer>
    </div>
  );
}
