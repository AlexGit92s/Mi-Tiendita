export type PrintPaperFormat =
  | 'letter'
  | 'legal'
  | 'half-letter'
  | 'thermal-80mm'
  | 'thermal-58mm';

export type PrintDeviceType = 'standard' | 'thermal';

export type PrintDocumentType =
  | 'apartado'
  | 'factura'
  | 'ticket'
  | 'recibo'
  | 'cotizacion'
  | 'orden-trabajo';

export interface PrintMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PrintSettings {
  defaultPaper: PrintPaperFormat;
  deviceType: PrintDeviceType;
  margins: PrintMargins;
  showLogo: boolean;
  showQr: boolean;
  showSignature: boolean;
  fontSize: number;
  autoPrint: boolean;
}

export interface PrintLineItem {
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PrintTotalRow {
  label: string;
  amount: number;
  strong?: boolean;
}

export interface PrintTimelineItem {
  label: string;
  date?: string | null;
  detail?: string | null;
}

export interface PrintParty {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface PrintBrand {
  name: string;
  subtitle?: string;
  logoUrl?: string | null;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PrintDocumentData {
  documentType: PrintDocumentType;
  title: string;
  documentNumber: string;
  issueDate: string;
  statusLabel?: string;
  brand: PrintBrand;
  customer?: PrintParty;
  summary?: string;
  qrValue?: string;
  notes?: string | null;
  payment?: {
    reference?: string | null;
    transferredBy?: string | null;
    confirmedAt?: string | null;
  };
  items: PrintLineItem[];
  totals: PrintTotalRow[];
  timeline?: PrintTimelineItem[];
  signatureLabel?: string;
}

export interface PrintRenderRequest {
  format: PrintPaperFormat;
  settings: PrintSettings;
  data: PrintDocumentData;
  mode?: 'print' | 'pdf' | 'preview';
}
