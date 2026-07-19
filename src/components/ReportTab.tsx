import React, { useRef } from 'react';
import { AnalysisRecord } from '../types';
import { Printer, Download, HelpCircle, Activity } from 'lucide-react';

interface ReportTabProps {
  lastRecord: AnalysisRecord | null;
}

export const ReportTab: React.FC<ReportTabProps> = ({ lastRecord }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const triggerPrint = () => {
    window.print();
  };

  const downloadTextReport = () => {
    if (!lastRecord) return;
    const r = lastRecord;
    const d = new Date(r.ts);

    let text = `========================================================\n`;
    text += `       MICROSCOPE LABORATORY CELL COUNTER REPORT\n`;
    text += `========================================================\n\n`;
    text += `Timestamp:       ${d.toLocaleDateString()} ${d.toLocaleTimeString()}\n`;
    text += `Report ID:       #REP-${r.id.substring(0, 8).toUpperCase()}\n`;
    text += `Magnification:   ${r.params.mag}x\n`;
    text += `Slide Frame:     ${r.params.smp === 'hemocytometer' ? 'Hemocytometer' : 'Blood Smear'}\n`;
    text += `Illumination:    ${r.params.imgType === 'stained' ? 'Giemsa Stained' : 'Unstained'}\n`;
    text += `Dilution Factor: ${r.params.dilution}x\n\n`;
    text += `--------------------------------------------------------\n`;
    text += `COMPLETE BLOOD CELL COUNTS (CBC)\n`;
    text += `--------------------------------------------------------\n`;
    text += `Parameter        Result          Unit          Status\n`;
    text += `--------------------------------------------------------\n`;
    text += `RBC Count        ${r.rbc.toLocaleString().padEnd(14)} cells/field  —\n`;
    text += `WBC Count        ${r.wbc.toLocaleString().padEnd(14)} cells/field  —\n`;
    text += `Platelet Count   ${r.plt.toLocaleString().padEnd(14)} cells/field  —\n`;
    text += `Total Segmented  ${r.total.toLocaleString().padEnd(14)} cells/field  —\n`;
    text += `RBC Conc.        ${(r.rbcUl > 0 ? r.rbcUl.toLocaleString() : '—').padEnd(14)} /μL           ${r.rbcUl >= 4500000 && r.rbcUl <= 5500000 ? 'Normal' : 'Out of range'}\n`;
    text += `WBC Conc.        ${(r.wbcUl > 0 ? r.wbcUl.toLocaleString() : '—').padEnd(14)} /μL           ${r.wbcUl >= 4000 && r.wbcUl <= 11000 ? 'Normal' : 'Out of range'}\n\n`;
    text += `--------------------------------------------------------\n`;
    text += `WHITE BLOOD CELL DIFFERENTIAL\n`;
    text += `--------------------------------------------------------\n`;
    text += `Cell Type        Percent         Normal Range  Status\n`;
    text += `--------------------------------------------------------\n`;
    text += `Neutrophils      ${(r.diff.n + '%').padEnd(14)} 40 - 70%     ${r.diff.n >= 40 && r.diff.n <= 70 ? 'Normal' : 'Out'}\n`;
    text += `Lymphocytes      ${(r.diff.l + '%').padEnd(14)} 20 - 40%     ${r.diff.l >= 20 && r.diff.l <= 40 ? 'Normal' : 'Out'}\n`;
    text += `Monocytes        ${(r.diff.m + '%').padEnd(14)} 2 - 8%       ${r.diff.m >= 2 && r.diff.m <= 8 ? 'Normal' : 'Out'}\n`;
    text += `Eosinophils      ${(r.diff.e + '%').padEnd(14)} 1 - 4%       ${r.diff.e >= 1 && r.diff.e <= 4 ? 'Normal' : 'Out'}\n`;
    text += `Basophils        ${(r.diff.b + '%').padEnd(14)} 0 - 1%       ${r.diff.b <= 1 ? 'Normal' : 'Out'}\n\n`;
    text += `--------------------------------------------------------\n`;
    text += `CELL MORPHOLOGY STATS\n`;
    text += `--------------------------------------------------------\n`;
    text += `Avg Cell Circularity: ${r.avgC}\n`;
    text += `Avg Cell Diameter:    ${r.avgD} μm\n`;
    text += `Segmented Objects:    ${r.nObj} identified\n\n`;
    text += `Generated automatically via Computer Vision. Not a replacement for professional diagnostic consultation.\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `cell_lab_report_${Date.now()}.txt`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!lastRecord) {
    return (
      <div id="report-empty" className="rounded-2xl border border-white/5 bg-[#121214] p-12 text-center text-[#71717A]">
        <Activity size={36} className="text-zinc-700 mb-3 mx-auto" />
        <span className="text-xs font-bold uppercase tracking-wider">No Active Diagnostics</span>
        <p className="text-[10px] max-w-xs mt-1.5 mx-auto text-[#52525B]">
          You must run a microscope cell analysis and save it to generate an official laboratory diagnostics report sheet.
        </p>
      </div>
    );
  }

  const date = new Date(lastRecord.ts);
  const isHealthyRbc = lastRecord.rbcUl >= 4500000 && lastRecord.rbcUl <= 5500000;
  const isHealthyWbc = lastRecord.wbcUl >= 4000 && lastRecord.wbcUl <= 11000;

  return (
    <div id="report-tab-content" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Laboratory Diagnostics</h3>
          <p className="text-[11px] text-[#A1A1AA]">Official formatted medical report of the most recently saved scan.</p>
        </div>

        <div className="flex gap-2">
          <button
            id="btn-print-report"
            onClick={triggerPrint}
            className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-[#D4D4D8] transition hover:bg-[#202024] hover:text-white"
          >
            <Printer size={13} /> Print Report
          </button>
          <button
            id="btn-download-report-txt"
            onClick={downloadTextReport}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/15 transition-all active:scale-95"
          >
            <Download size={13} /> Download (.txt)
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div
        id="report-printable-area"
        ref={reportRef}
        className="rounded-2xl border border-white/5 bg-[#121214] p-8 shadow-md max-w-3xl mx-auto text-[#E4E4E7] print:bg-white print:text-black print:border-none print:shadow-none print:p-0"
      >
        {/* Report Header */}
        <div className="border-b-2 border-zinc-800 print:border-black pb-5 flex justify-between items-start">
          <div>
            <h1 className="text-base font-black tracking-tight text-white print:text-black uppercase">Microscope Laboratory Report</h1>
            <p className="text-[11px] font-medium text-zinc-400 print:text-slate-500 mt-1">AUTOMATED BLOOD ANALYSIS SYSTEM</p>
          </div>
          <div className="text-right text-[10px] text-zinc-500 print:text-slate-500">
            <div>Report ID: <strong className="text-[#E4E4E7] print:text-slate-700 font-mono">#REP-{lastRecord.id.substring(0, 8).toUpperCase()}</strong></div>
            <div className="mt-1">Date: <strong className="text-[#E4E4E7] print:text-slate-700">{date.toLocaleDateString()} {date.toLocaleTimeString()}</strong></div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-5 border-b border-white/5 print:border-slate-100 text-[11px]">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] print:text-slate-450">Sample Type</span>
            <div className="font-semibold text-[#E4E4E7] print:text-slate-700 mt-0.5 capitalize">
              {lastRecord.params.smp === 'hemocytometer' ? 'Hemocytometer Neubauer' : 'Peripheral Blood Smear'}
            </div>
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] print:text-slate-450">Magnification</span>
            <div className="font-semibold text-[#E4E4E7] print:text-slate-700 mt-0.5">{lastRecord.params.mag}x Object</div>
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] print:text-slate-450">Dilution Ratio</span>
            <div className="font-semibold text-[#E4E4E7] print:text-slate-700 mt-0.5">{lastRecord.params.dilution}x factor</div>
          </div>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#71717A] print:text-slate-450">Slide Contrast</span>
            <div className="font-semibold text-[#E4E4E7] print:text-slate-700 mt-0.5 capitalize">{lastRecord.params.imgType} smear</div>
          </div>
        </div>

        {/* Complete Blood Count section */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-bold text-white print:text-black uppercase tracking-wider border-b border-white/5 print:border-slate-200 pb-1.5">
            Complete Blood Counts (CBC) Analysis
          </h3>
          <table className="w-full text-left text-xs text-[#E4E4E7] print:text-slate-700">
            <thead>
              <tr className="border-b border-white/5 print:border-slate-100 text-[10px] text-zinc-500 print:text-slate-400 uppercase font-bold">
                <th className="py-2">Biological Parameter</th>
                <th className="py-2 text-right">Result</th>
                <th className="py-2 text-right">Reference Range</th>
                <th className="py-2 text-right">Diagnostic Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-slate-50">
              <tr>
                <td className="py-2.5 font-semibold">Total RBC Density (per Field)</td>
                <td className="py-2.5 text-right font-mono font-medium">{lastRecord.rbc.toLocaleString()} cells</td>
                <td className="py-2.5 text-right text-zinc-500 print:text-slate-400">—</td>
                <td className="py-2.5 text-right font-semibold text-zinc-400 print:text-slate-500">Measured</td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold">Total WBC Density (per Field)</td>
                <td className="py-2.5 text-right font-mono font-medium">{lastRecord.wbc.toLocaleString()} cells</td>
                <td className="py-2.5 text-right text-zinc-500 print:text-slate-400">—</td>
                <td className="py-2.5 text-right font-semibold text-zinc-400 print:text-slate-500">Measured</td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold">Total Platelets (per Field)</td>
                <td className="py-2.5 text-right font-mono font-medium">{lastRecord.plt.toLocaleString()} cells</td>
                <td className="py-2.5 text-right text-zinc-500 print:text-slate-400">—</td>
                <td className="py-2.5 text-right font-semibold text-zinc-400 print:text-slate-500">Measured</td>
              </tr>
              {lastRecord.rbcUl > 0 && (
                <tr>
                  <td className="py-2.5 font-semibold">Erythrocyte Concentration</td>
                  <td className="py-2.5 text-right font-mono font-bold text-indigo-400 print:text-slate-800">{lastRecord.rbcUl.toLocaleString()} / μL</td>
                  <td className="py-2.5 text-right text-zinc-500 print:text-slate-400">4.5M - 5.5M / μL</td>
                  <td className={`py-2.5 text-right font-bold ${isHealthyRbc ? 'text-emerald-400 print:text-green-600' : 'text-rose-400 print:text-red-500'}`}>
                    {isHealthyRbc ? 'Normal' : 'Out of range'}
                  </td>
                </tr>
              )}
              {lastRecord.wbcUl > 0 && (
                <tr>
                  <td className="py-2.5 font-semibold">Leukocyte Concentration</td>
                  <td className="py-2.5 text-right font-mono font-bold text-indigo-400 print:text-slate-800">{lastRecord.wbcUl.toLocaleString()} / μL</td>
                  <td className="py-2.5 text-right text-zinc-500 print:text-slate-400">4,000 - 11,000 / μL</td>
                  <td className={`py-2.5 text-right font-bold ${isHealthyWbc ? 'text-emerald-400 print:text-green-600' : 'text-rose-400 print:text-red-500'}`}>
                    {isHealthyWbc ? 'Normal' : 'Out of range'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* WBC Differential section */}
        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-bold text-white print:text-black uppercase tracking-wider border-b border-white/5 print:border-slate-200 pb-1.5">
            White Blood Cell Differential Count
          </h3>
          <table className="w-full text-left text-xs text-[#E4E4E7] print:text-slate-700">
            <thead>
              <tr className="border-b border-white/5 print:border-slate-100 text-[10px] text-zinc-500 print:text-slate-400 uppercase font-bold">
                <th className="py-2">Cell Type Class</th>
                <th className="py-2 text-right">Count</th>
                <th className="py-2 text-right">Percent (%)</th>
                <th className="py-2 text-right">Standard Ref. Range</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-slate-50">
              {[
                { name: 'Neutrophils', pct: lastRecord.diff.n, ref: '40% - 70%', isOk: lastRecord.diff.n >= 40 && lastRecord.diff.n <= 70 },
                { name: 'Lymphocytes', pct: lastRecord.diff.l, ref: '20% - 40%', isOk: lastRecord.diff.l >= 20 && lastRecord.diff.l <= 40 },
                { name: 'Monocytes', pct: lastRecord.diff.m, ref: '2% - 8%', isOk: lastRecord.diff.m >= 2 && lastRecord.diff.m <= 8 },
                { name: 'Eosinophils', pct: lastRecord.diff.e, ref: '1% - 4%', isOk: lastRecord.diff.e >= 1 && lastRecord.diff.e <= 4 },
                { name: 'Basophils', pct: lastRecord.diff.b, ref: '0% - 1%', isOk: lastRecord.diff.b <= 1 },
              ].map((row, idx) => {
                const count = Math.round((row.pct / 100) * lastRecord.wbc);
                return (
                  <tr key={idx}>
                    <td className="py-2.5 font-semibold text-zinc-300 print:text-slate-700">{row.name}</td>
                    <td className="py-2.5 text-right font-mono">{count}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-white print:text-slate-800">{row.pct}%</td>
                    <td className="py-2.5 text-right text-zinc-500 print:text-slate-400">{row.ref}</td>
                    <td className={`py-2.5 text-right font-bold ${row.isOk ? 'text-emerald-400 print:text-green-600' : 'text-rose-400 print:text-red-500'}`}>
                      {row.isOk ? 'Normal' : 'Out'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Morphology Details */}
        <div className="mt-8 space-y-3">
          <h3 className="text-xs font-bold text-white print:text-black uppercase tracking-wider border-b border-white/5 print:border-slate-200 pb-1.5">
            Cellular Morphological Indices
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-[#18181B] print:bg-slate-50 rounded-xl p-3 border border-white/5 print:border-slate-100">
              <span className="text-[10px] text-zinc-500 print:text-slate-400 uppercase font-bold">Avg RBC/WBC Diameter</span>
              <div className="text-base font-extrabold text-white print:text-slate-800 mt-1">{lastRecord.avgD} μm</div>
            </div>
            <div className="bg-[#18181B] print:bg-slate-50 rounded-xl p-3 border border-white/5 print:border-slate-100">
              <span className="text-[10px] text-zinc-500 print:text-slate-400 uppercase font-bold">Avg Circularity Factor</span>
              <div className="text-base font-extrabold text-white print:text-slate-800 mt-1">{lastRecord.avgC}</div>
            </div>
            <div className="bg-[#18181B] print:bg-slate-50 rounded-xl p-3 border border-white/5 print:border-slate-100">
              <span className="text-[10px] text-zinc-500 print:text-slate-400 uppercase font-bold">Identified Segments</span>
              <div className="text-base font-extrabold text-white print:text-slate-800 mt-1">{lastRecord.nObj} objects</div>
            </div>
          </div>
        </div>

        {/* Report Footer Notice */}
        <div className="mt-10 pt-5 border-t border-dashed border-zinc-800 print:border-slate-200 text-center text-[9px] text-[#71717A] print:text-slate-400 leading-relaxed max-w-lg mx-auto">
          This cell diagnostics analysis was generated automatically utilizing high-resolution pixel edge-detection and morphological circularity filters. Not intended for use in self-treatment or replacing standard professional healthcare advice.
        </div>
      </div>
    </div>
  );
};
