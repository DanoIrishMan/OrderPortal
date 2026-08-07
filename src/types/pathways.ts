export interface PathwayCsvRow {
  row: number;
  clientName: string;
  accountManagerName: string;
  designerName: string;
  pathwayName: string;
  taskTitle: string;
  deadline: string;
}

export interface PathwayCsvGroupPreview {
  key: string;
  clientName: string;
  clientId: string | null;
  accountManagerName: string;
  accountManagerId: string | null;
  designerName: string;
  designerId: string | null;
  pathwayName: string;
  tasks: Array<{ row: number; title: string; dueDate: string; dueDateParsed: boolean }>;
}

export interface PathwayCsvPreviewResult {
  headers: string[];
  totalRows: number;
  groups: PathwayCsvGroupPreview[];
  errors: Array<{ row: number; message: string }>;
  wouldCreate: number;
  wouldSkip: number;
}

export interface PathwayCsvImportResult {
  created: number;
  skipped: number;
  errors: string[];
  pathwayIds: string[];
}
