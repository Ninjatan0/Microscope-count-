export type CellType = 'rbc' | 'wbc' | 'platelet';

export interface DetectedCell {
  id: string;
  type: CellType;
  area: number;
  aum: number; // area in um^2
  dia: number; // diameter in um
  circ: number; // circularity
  sol: number; // solidity
  hue: number;
  sat: number;
  cx: number; // center x
  cy: number; // center y
  bw: number; // bounding box width
  bh: number; // bounding box height
  ar: number; // aspect ratio
  manuallyAdded?: boolean;
}

export interface AnalysisParams {
  mag: 10 | 40 | 100;
  imgType: 'stained' | 'unstained';
  smp: 'smear' | 'hemocytometer';
  dilution: number;
  minSize: number;
  circularity: number;
  maxArea: number;
  blur: number;
}

export interface WbcDifferential {
  n: number; // Neutrophils %
  l: number; // Lymphocytes %
  m: number; // Monocytes %
  e: number; // Eosinophils %
  b: number; // Basophils %
}

export interface AnalysisRecord {
  id: string;
  ts: string; // ISO timestamp
  params: AnalysisParams;
  rbc: number;
  wbc: number;
  plt: number;
  total: number;
  conc: string;
  rbcUl: number;
  wbcUl: number;
  diff: WbcDifferential;
  avgC: string;
  avgD: string;
  nObj: number;
  cellData: DetectedCell[];
  imgDataUrl?: string; // Loaded image
  processedImgDataUrl?: string; // Bounding boxes overlay
}

export interface SampleImage {
  id: string;
  name: string;
  type: 'stained' | 'unstained' | 'hemocytometer';
  url: string;
  description: string;
  params?: Partial<AnalysisParams>;
}
