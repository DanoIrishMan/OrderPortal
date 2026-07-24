export interface ParsedOrderRow {
  orderNumber: string;
  orderDate?: string | null;
  poNumber?: string | null;
  csvCustomerName?: string | null;
  section?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  status?: string | null;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  notes?: string | null;
  lineItems?: Array<{ description: string; quantity?: number; unitPrice?: number }>;
  isDuplicate?: boolean;
  existingOrderId?: string;
  warnings?: string[];
}

export interface CsvMappingConfig {
  orderNumber: string;
  orderDate?: string;
  poNumber?: string;
  description?: string;
  quantity?: string;
  unitPrice?: string;
  totalPrice?: string;
  status?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  notes?: string;
}

export interface CsvUpdateResult {
  updated: number;
  notFound: Array<{ row: number; orderNumber: string; data: Record<string, string> }>;
  skipped: number;
  errors: string[];
}

export type CustomerMappingValue = string | "skip";

export interface WeeklyCsvCustomerInfo {
  csvCustomerName: string;
  rowCount: number;
  mappedClientId: string | null;
  mappedClientName: string | null;
  isSkipped: boolean;
}

export interface WeeklyCsvByClientStats {
  clientId: string;
  clientName: string;
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
}

export interface WeeklyCsvPreviewResult {
  isSalesRepSummary: boolean;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  customers: WeeklyCsvCustomerInfo[];
  byClient: WeeklyCsvByClientStats[];
  unmappedCustomers: string[];
  wouldCreate: number;
  wouldUpdate: number;
  wouldSkip: number;
}

export interface WeeklyCsvImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  unmappedCustomers: string[];
  clientsCreated: string[];
  byClient: WeeklyCsvByClientStats[];
}

export interface ImportReviewData {
  batchId: string;
  clientId: string;
  clientName: string;
  filename: string;
  rows: ParsedOrderRow[];
}
