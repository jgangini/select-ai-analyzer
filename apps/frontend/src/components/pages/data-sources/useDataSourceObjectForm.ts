import { useState } from 'react';

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

export function useDataSourceObjectForm(showToast: ShowToast, helpers: DataSourceObjectFormHelpers) {
  const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);
  const [objectMode, setObjectMode] = useState<DataSourceObjectMode>('csv');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [metadataJsonFile, setMetadataJsonFile] = useState<File | null>(null);
  const [csvHeaderColumns, setCsvHeaderColumns] = useState<string[]>([]);
  const [csvTableName, setCsvTableName] = useState('');
  const [csvSchemaName, setCsvSchemaName] = useState(helpers.defaultDataSchema);
  const [pendingSchemaCreation, setPendingSchemaCreation] = useState<string | null>(null);
  const [tableOwner, setTableOwner] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableComment, setTableComment] = useState('');
  const [columnMetadata, setColumnMetadata] = useState<DataSourceColumnMetadata[]>([]);
  const normalizedCsvSchema = helpers.normalizeIdentifier(csvSchemaName);

  const resetObjectMetadata = () => {
    setMetadataJsonFile(null);
    setCsvHeaderColumns([]);
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

  const handleCsvFileChange = (file: File | null) => {
    setCsvFile(file);
    setCsvHeaderColumns([]);
    if (!file) {
      setColumnMetadata([]);
      return;
    }

    file
      .text()
      .then((text) => {
        const headers = helpers.parseCsvHeaders(text);
        setCsvHeaderColumns(headers);
        setColumnMetadata((current) => helpers.mergeMetadataWithColumns(headers, current));
      })
      .catch(() => showToast('Could not read CSV header.', 'error'));
  };

  const handleMetadataJsonFileChange = (file: File | null) => {
    setMetadataJsonFile(file);
    if (!file) return;

    file
      .text()
      .then((text) => {
        const metadata = helpers.parseMetadataJson(text);
        if (metadata.tableComment) setTableComment(metadata.tableComment);
        setColumnMetadata(
          csvHeaderColumns.length > 0
            ? helpers.mergeMetadataWithColumns(csvHeaderColumns, metadata.columns)
            : metadata.columns
        );
        showToast('Metadata JSON loaded.', 'success');
      })
      .catch((error) => showToast(helpers.getErrorMessage(error), 'error'));
  };

  const state = {
    isObjectModalOpen, setIsObjectModalOpen, objectMode, csvFile, setCsvFile, metadataJsonFile,
    csvTableName, setCsvTableName, csvSchemaName, setCsvSchemaName, normalizedCsvSchema,
    pendingSchemaCreation, setPendingSchemaCreation, tableOwner, setTableOwner, tableName, setTableName,
    tableComment, setTableComment, columnMetadata, setColumnMetadata,
  };
  const actions = {
    openObjectModal, changeObjectMode, changeTableOwner, changeTableName, updateColumnMetadata,
    handleCsvFileChange, handleMetadataJsonFileChange, resetObjectMetadata,
  };

  return { ...state, ...actions };
}

export type DataSourceObjectFormState = ReturnType<typeof useDataSourceObjectForm>;
