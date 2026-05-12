import { useState } from 'react';

import type { DataSourceCsvUploadDraft } from './dataSourceUtils';

type ShowToast = (message: string, variant?: 'success' | 'error' | 'info' | 'warning') => void;

type DataSourceObjectMode = 'csv' | 'existing_table';

type DataSourceColumnMetadata = {
  column_name: string;
  data_type?: string;
  data_length?: number;
  nullable?: string;
  ordinal_position?: number;
  comment?: string;
  ui_display?: string;
  classification?: string;
  primary_key?: boolean;
};

type ParsedMetadata = { tableComment: string; columns: DataSourceColumnMetadata[] };

type CsvUploadSlot = {
  baseName: string;
  csvFile: File | null;
  metadataJsonFile: File | null;
  order: number;
};

type CsvUploadSlotCollection = {
  slots: CsvUploadSlot[];
  issues: string[];
  csvBaseCounts: Map<string, number>;
  jsonBaseCounts: Map<string, number>;
};

type DataSourceObjectFormHelpers = {
  defaultDataSchema: string;
  getErrorMessage: (error: unknown) => string;
  mergeMetadataWithColumns: (
    columnNames: string[],
    metadata: DataSourceColumnMetadata[]
  ) => DataSourceColumnMetadata[];
  normalizeIdentifier: (value: string) => string;
  parseCsvHeaders: (csvText: string) => string[];
  parseMetadataJson: (text: string) => ParsedMetadata;
};

function uploadFileBaseName(fileName: string): string {
  return String(fileName || '').replace(/\.[^.]+$/, '').trim();
}

function isCsvUploadFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv');
}

function isMetadataUploadFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.json');
}

function tableNameFromBaseName(baseName: string, normalizeIdentifier: (value: string) => string): string {
  const normalized = normalizeIdentifier(baseName.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/_+/g, '_'));
  return /^[A-Z]/.test(normalized) ? normalized : `T_${normalized}`;
}

function readUploadFileText(file: File): Promise<string> {
  const textReader = (file as File & { text?: () => Promise<string> }).text;
  if (typeof textReader === 'function') return textReader.call(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('File could not be read.'));
    reader.readAsText(file);
  });
}

function collectCsvUploadSlots(
  currentDrafts: DataSourceCsvUploadDraft[],
  selectedFiles: File[]
): CsvUploadSlotCollection {
  const issues: string[] = [];
  const slotMap = new Map<string, CsvUploadSlot>();
  const csvBaseCounts = new Map<string, number>();
  const jsonBaseCounts = new Map<string, number>();
  let nextOrder = 0;

  currentDrafts.forEach((draft) => {
    slotMap.set(draft.baseName.toLowerCase(), {
      baseName: draft.baseName,
      csvFile: draft.csvFile,
      metadataJsonFile: draft.metadataJsonFile,
      order: nextOrder,
    });
    nextOrder += 1;
  });

  selectedFiles.forEach((file) => {
    const isCsvFile = isCsvUploadFile(file);
    const isJsonFile = isMetadataUploadFile(file);
    if (!isCsvFile && !isJsonFile) {
      issues.push(`${file.name} is not a CSV or JSON file.`);
      return;
    }

    const baseName = uploadFileBaseName(file.name);
    const key = baseName.toLowerCase();
    const slot = slotMap.get(key) || { baseName, csvFile: null, metadataJsonFile: null, order: nextOrder };
    if (!slotMap.has(key)) nextOrder += 1;

    if (isCsvFile) {
      csvBaseCounts.set(key, (csvBaseCounts.get(key) || 0) + 1);
      slot.csvFile = file;
      slot.baseName = baseName;
    }
    if (isJsonFile) {
      jsonBaseCounts.set(key, (jsonBaseCounts.get(key) || 0) + 1);
      slot.metadataJsonFile = file;
    }
    slotMap.set(key, slot);
  });

  csvBaseCounts.forEach((count, key) => {
    if (count > 1) issues.push(`Duplicate CSV file for ${key}.`);
  });
  jsonBaseCounts.forEach((count, key) => {
    if (count > 1) issues.push(`Duplicate JSON metadata for ${key}.`);
  });

  const slots = Array.from(slotMap.values()).sort((left, right) => left.order - right.order);
  if (!slots.some((slot) => slot.csvFile)) issues.push('Select at least one CSV file.');
  slots.forEach((slot) => {
    if (!slot.csvFile && slot.metadataJsonFile) issues.push(`${slot.metadataJsonFile.name} has no matching CSV file.`);
  });

  return { slots, issues, csvBaseCounts, jsonBaseCounts };
}

async function buildCsvUploadDraft(
  slot: CsvUploadSlot,
  helpers: DataSourceObjectFormHelpers,
  csvBaseCounts: Map<string, number>,
  jsonBaseCounts: Map<string, number>
): Promise<DataSourceCsvUploadDraft> {
  const csvFile = slot.csvFile as File;
  const baseName = uploadFileBaseName(csvFile.name);
  const matchKey = baseName.toLowerCase();
  const metadataJsonFile = slot.metadataJsonFile;
  const draftIssues: string[] = [];
  let headers: string[] = [];
  let tableCommentValue = '';
  let metadataColumns: DataSourceColumnMetadata[] = [];

  if ((csvBaseCounts.get(matchKey) || 0) > 1) draftIssues.push('Duplicate CSV base name.');
  if ((jsonBaseCounts.get(matchKey) || 0) > 1) draftIssues.push('Duplicate JSON metadata.');
  if (!metadataJsonFile) draftIssues.push('Missing matching JSON metadata.');

  try {
    headers = helpers.parseCsvHeaders(await readUploadFileText(csvFile));
    if (headers.length === 0) draftIssues.push('CSV header row is empty.');
  } catch {
    draftIssues.push('CSV header could not be read.');
  }

  if (metadataJsonFile) {
    try {
      const metadata = helpers.parseMetadataJson(await readUploadFileText(metadataJsonFile));
      tableCommentValue = metadata.tableComment;
      metadataColumns = metadata.columns;
    } catch (error) {
      draftIssues.push(helpers.getErrorMessage(error));
    }
  }

  return {
    id: matchKey,
    baseName,
    csvFile,
    metadataJsonFile,
    tableName: tableNameFromBaseName(baseName, helpers.normalizeIdentifier),
    tableComment: tableCommentValue,
    columnMetadata: headers.length > 0
      ? helpers.mergeMetadataWithColumns(headers, metadataColumns)
      : metadataColumns,
    error: draftIssues.join(' ') || null,
  };
}

async function buildCsvUploadDrafts(
  currentDrafts: DataSourceCsvUploadDraft[],
  selectedFiles: File[],
  helpers: DataSourceObjectFormHelpers
): Promise<{ drafts: DataSourceCsvUploadDraft[]; issues: string[] }> {
  const collection = collectCsvUploadSlots(currentDrafts, selectedFiles);
  const csvSlots = collection.slots.filter((slot) => slot.csvFile);
  const drafts = await Promise.all(
    csvSlots.map((slot) => buildCsvUploadDraft(slot, helpers, collection.csvBaseCounts, collection.jsonBaseCounts))
  );
  return { drafts, issues: collection.issues };
}

export function useDataSourceObjectForm(showToast: ShowToast, helpers: DataSourceObjectFormHelpers) {
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [objectMode, setObjectMode] = useState<DataSourceObjectMode>('csv');
  const [csvUploadDrafts, setCsvUploadDrafts] = useState<DataSourceCsvUploadDraft[]>([]);
  const [activeCsvUploadId, setActiveCsvUploadId] = useState<string | null>(null);
  const [csvUploadIssues, setCsvUploadIssues] = useState<string[]>([]);
  const [csvSchemaName, setCsvSchemaName] = useState(helpers.defaultDataSchema);
  const [pendingSchemaCreation, setPendingSchemaCreation] = useState<string | null>(null);
  const [tableOwner, setTableOwner] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableComment, setTableComment] = useState('');
  const [columnMetadata, setColumnMetadata] = useState<DataSourceColumnMetadata[]>([]);
  const normalizedCsvSchema = helpers.normalizeIdentifier(csvSchemaName);

  const resetObjectMetadata = () => {
    setCsvUploadDrafts([]);
    setActiveCsvUploadId(null);
    setCsvUploadIssues([]);
    setTableComment('');
    setColumnMetadata([]);
  };

  const openObjectModal = () => {
    setObjectMode('csv');
    resetObjectMetadata();
    setIsObjectModalOpen(true);
  };

  const changeObjectMode = (mode: DataSourceObjectMode) => {
    setPendingSchemaCreation(null);
    setObjectMode(mode);
    resetObjectMetadata();
  };

  const changeTableOwner = (owner: string) => {
    setTableOwner(owner);
    setTableName('');
    setTableComment('');
    setColumnMetadata([]);
  };

  const changeTableName = (name: string) => {
    setTableName(name);
    setTableComment('');
    setColumnMetadata([]);
  };

  const updateColumnMetadata = (index: number, patch: Partial<DataSourceColumnMetadata>) => {
    setColumnMetadata((current) =>
      current.map((column, columnIndex) => (columnIndex === index ? { ...column, ...patch } : column))
    );
  };

  const updateActiveCsvUploadMetadata = (index: number, patch: Partial<DataSourceColumnMetadata>) => {
    setCsvUploadDrafts((current) =>
      current.map((draft) =>
        draft.id === activeCsvUploadId
          ? {
              ...draft,
              columnMetadata: draft.columnMetadata.map((column, columnIndex) =>
                columnIndex === index ? { ...column, ...patch } : column
              ),
            }
          : draft
      )
    );
  };

  const removeCsvUploadDraft = (id: string) => {
    setCsvUploadDrafts((current) => {
      const nextDrafts = current.filter((draft) => draft.id !== id);
      setActiveCsvUploadId((currentActiveId) =>
        currentActiveId === id ? nextDrafts[0]?.id ?? null : currentActiveId
      );
      return nextDrafts;
    });
  };

  const handleCsvUploadFilesChange = (files: FileList | File[] | null) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;

    buildCsvUploadDrafts(csvUploadDrafts, selectedFiles, helpers)
      .then(({ drafts, issues }) => {
        setCsvUploadDrafts(drafts);
        setActiveCsvUploadId((currentActiveId) =>
          drafts.some((draft) => draft.id === currentActiveId) ? currentActiveId : drafts[0]?.id ?? null
        );
        setCsvUploadIssues(issues);
        setColumnMetadata([]);
        setTableComment('');
      })
      .catch((error) => showToast(helpers.getErrorMessage(error), 'error'));
  };

  const state = {
    isObjectModalOpen, setIsObjectModalOpen, objectMode, csvUploadDrafts, setCsvUploadDrafts,
    activeCsvUploadId, setActiveCsvUploadId, csvUploadIssues, setCsvUploadIssues,
    csvSchemaName, setCsvSchemaName, normalizedCsvSchema,
    pendingSchemaCreation, setPendingSchemaCreation, tableOwner, setTableOwner, tableName, setTableName,
    tableComment, setTableComment, columnMetadata, setColumnMetadata,
  };
  const actions = {
    openObjectModal, changeObjectMode, changeTableOwner, changeTableName, updateColumnMetadata,
    handleCsvUploadFilesChange, updateActiveCsvUploadMetadata, removeCsvUploadDraft, resetObjectMetadata,
  };

  return { ...state, ...actions };
}

export type DataSourceObjectFormState = ReturnType<typeof useDataSourceObjectForm>;
