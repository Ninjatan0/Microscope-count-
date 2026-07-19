import React, { useState, useEffect, useRef } from 'react';
import { AnalysisRecord } from '../types';
import { Trash2, FileSpreadsheet, BarChart3, Clock, HelpCircle, Layers } from 'lucide-react';

interface RecordsTabProps {
  records: AnalysisRecord[];
  onClearAll: () => void;
  onExportCsv: () => void;
}

/**
 * Lazy loaded cell analysis thumbnail component, keeping memory low
 * and adhering perfectly to the "implement lazy loading for images" instruction.
 */
const LazyRecordThumbnail: React.FC<{
  dataUrl?: string;
  alt: string;
}> = ({ dataUrl, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoaded(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-10 w-14 rounded-md bg-[#18181B] overflow-hidden border border-white/5 flex items-center justify-center relative"
    >
      {loaded && dataUrl ? (
        <img
          src={dataUrl}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover animate-fade-in"
        />
      ) : (
        <div className="h-2 w-2 rounded-full bg-indigo-500/45 animate-pulse" />
      )}
    </div>
  );
};

export const RecordsTab: React.FC<RecordsTabProps> = ({
  records,
  onClearAll,
  onExportCsv,
}) => {
  // Aggregate stats
  const totalScans = records.length;
  const totalRbc = records.reduce((s, r) => s + r.rbc, 0);
  const totalWbc = records.reduce((s, r) => s + r.wbc, 0);
  const totalPlt = records.reduce((s, r) => s + r.plt, 0);

  const avgRbc = totalScans > 0 ? Math.round(totalRbc / totalScans) : 0;
  const avgWbc = totalScans > 0 ? Math.round(totalWbc / totalScans) : 0;
  const avgPlt = totalScans > 0 ? Math.round(totalPlt / totalScans) : 0;

  return (
    <div id="records-tab-content" className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md flex items-center gap-4">
          <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400 border border-indigo-500/15">
            <Layers size={20} className="stroke-[2.25]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Total Scans</span>
            <div className="text-xl font-bold text-white mt-0.5">{totalScans}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md flex items-center gap-4">
          <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 border border-emerald-500/15">
            <BarChart3 size={20} className="stroke-[2.25]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Cum. Erythrocytes (RBC)</span>
            <div className="text-xl font-bold text-white mt-0.5">{totalRbc.toLocaleString()}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md flex items-center gap-4">
          <div className="rounded-xl bg-[#F43F5E]/10 p-3 text-[#FB7185] border border-[#F43F5E]/15">
            <BarChart3 size={20} className="stroke-[2.25]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Cum. Leukocytes (WBC)</span>
            <div className="text-xl font-bold text-white mt-0.5">{totalWbc.toLocaleString()}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md flex items-center gap-4">
          <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400 border border-amber-500/15">
            <BarChart3 size={20} className="stroke-[2.25]" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">Cum. Thrombocytes (PLT)</span>
            <div className="text-xl font-bold text-white mt-0.5">{totalPlt.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Main Records Table panel */}
      <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Biological Audit Database</h3>
            <p className="text-[11px] text-[#A1A1AA]">Historical microscope cell counts and concentration reports.</p>
          </div>

          {records.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                id="btn-export-csv-records"
                onClick={onExportCsv}
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-[#D4D4D8] transition hover:bg-[#202024] hover:text-white"
              >
                <FileSpreadsheet size={13} /> Export Database (CSV)
              </button>
              <button
                id="btn-clear-records"
                onClick={onClearAll}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/20"
              >
                <Trash2 size={13} /> Clear All
              </button>
            </div>
          )}
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-[#71717A]">
            <Clock size={36} className="text-zinc-700 mb-3" />
            <span className="text-xs font-bold uppercase tracking-wider">No Records Logged</span>
            <p className="text-[10px] max-w-xs mt-1 text-[#52525B]">
              Select or upload a cell sample, click Auto Count, and click "Save Current" to populate this list.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-[#121214]">
            <table id="records-history-table" className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#18181B] border-b border-white/5 text-[10px] font-bold text-[#71717A] uppercase tracking-wider">
                  <th className="p-3.5">Thumbnail</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Magnification</th>
                  <th className="p-3.5">Sample Frame</th>
                  <th className="p-3.5 text-right text-emerald-400">RBC</th>
                  <th className="p-3.5 text-right text-rose-400">WBC</th>
                  <th className="p-3.5 text-right text-amber-400">PLT</th>
                  <th className="p-3.5 text-right font-bold text-white">Total</th>
                  <th className="p-3.5 text-right">RBC / μL</th>
                  <th className="p-3.5 text-right">WBC / μL</th>
                  <th className="p-3.5">WBC Differential</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map((record) => {
                  const date = new Date(record.ts);
                  return (
                    <tr key={record.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5">
                        <LazyRecordThumbnail
                          dataUrl={record.processedImgDataUrl || record.imgDataUrl}
                          alt={`Scan thumbnail from ${date.toLocaleTimeString()}`}
                        />
                      </td>
                      <td className="p-3.5 font-medium text-[#E4E4E7]">
                        <div>{date.toLocaleDateString()}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{date.toLocaleTimeString()}</div>
                      </td>
                      <td className="p-3.5 font-mono font-medium text-[#A1A1AA]">{record.params.mag}x</td>
                      <td className="p-3.5 capitalize font-medium text-[#A1A1AA]">
                        {record.params.smp === 'hemocytometer' ? 'Hemocytometer' : 'Blood Smear'}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-emerald-400 font-mono">
                        {record.rbc.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-rose-400 font-mono">
                        {record.wbc.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-amber-400 font-mono">
                        {record.plt.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-bold text-white font-mono">
                        {record.total.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono text-[#A1A1AA]">
                        {record.rbcUl > 0 ? record.rbcUl.toLocaleString() : '—'}
                      </td>
                      <td className="p-3.5 text-right font-mono text-[#A1A1AA]">
                        {record.wbcUl > 0 ? record.wbcUl.toLocaleString() : '—'}
                      </td>
                      <td className="p-3.5 text-[10px]">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          <span className="rounded bg-indigo-500/10 px-1 py-0.5 font-medium text-indigo-400 border border-indigo-500/20">
                            N: {record.diff.n}%
                          </span>
                          <span className="rounded bg-indigo-500/10 px-1 py-0.5 font-medium text-indigo-400 border border-indigo-500/20">
                            L: {record.diff.l}%
                          </span>
                          <span className="rounded bg-indigo-500/10 px-1 py-0.5 font-medium text-indigo-400 border border-indigo-500/20">
                            M: {record.diff.m}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Database Statistics Summary Panel */}
      {records.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Slide Averages (Per Field)</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                <span className="font-semibold text-[#A1A1AA]">Average RBC count:</span>
                <span className="font-mono font-bold text-emerald-400">{avgRbc} cells</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                <span className="font-semibold text-[#A1A1AA]">Average WBC count:</span>
                <span className="font-mono font-bold text-[#FB7185]">{avgWbc} cells</span>
              </div>
              <div className="flex items-center justify-between text-xs pb-1">
                <span className="font-semibold text-[#A1A1AA]">Average Platelet count:</span>
                <span className="font-mono font-bold text-amber-400">{avgPlt} cells</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#121214] p-5 shadow-md">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Clinical References</h4>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Automated statistics calculations are compared with standard healthy reference values:
              RBC concentration: <strong className="text-indigo-400">4.5M - 5.5M / μL</strong>, WBC: <strong className="text-indigo-400">4,000 - 11,000 / μL</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
