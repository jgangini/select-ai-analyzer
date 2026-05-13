import type { ReactNode } from 'react';

type DataSourceColumnMetadata = {
  column_name: string;
  data_type?: string;
  data_length?: number;
  comment?: string;
  ui_display?: string;
  classification?: string;
  primary_key?: boolean;
};

export function DataDictionaryEditor({
  columns,
  headerMeta,
  isLoading,
  onColumnChange,
  renderLoadingState,
  bodyClassName = 'min-h-0 flex flex-1 p-4',
  className = '',
  tableShellClassName = 'max-h-72 overflow-auto rounded border border-gray-200',
}: {
  columns: DataSourceColumnMetadata[];
  headerMeta?: ReactNode;
  isLoading?: boolean;
  onColumnChange: (index: number, patch: Partial<DataSourceColumnMetadata>) => void;
  renderLoadingState: () => ReactNode;
  bodyClassName?: string;
  className?: string;
  tableShellClassName?: string;
}) {
  return (
    <div className={`flex flex-col rounded-lg border border-oracle-border bg-white ${className}`}>
      <div className="flex min-w-0 items-center gap-3 border-b border-oracle-border px-4 py-3">
        <h3 className="text-sm font-semibold text-oracle-dark-gray">Data dictionary</h3>
        {headerMeta ? <div className="min-w-0 flex-1 text-sm text-oracle-medium-gray">{headerMeta}</div> : null}
      </div>
      <div className={bodyClassName}>
        <div className={tableShellClassName}>
          <table className="min-w-[760px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Column</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Comment</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">UI display</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Classification</th>
                <th className="w-16 px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">PK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-5">
                    {renderLoadingState()}
                  </td>
                </tr>
              ) : columns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-sm text-oracle-light-gray">
                    Select an object to edit metadata.
                  </td>
                </tr>
              ) : (
                columns.map((column, index) => (
                  <tr key={`${column.column_name}-${index}`}>
                    <td className="max-w-[180px] px-3 py-2 align-top">
                      <div className="truncate font-mono text-xs text-oracle-dark-gray" title={column.column_name}>
                        {column.column_name}
                      </div>
                      {column.data_type ? (
                        <div className="mt-0.5 truncate text-[11px] text-oracle-light-gray">
                          {column.data_type}
                          {column.data_length ? `(${column.data_length})` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={column.comment || ''}
                        onChange={(event) => onColumnChange(index, { comment: event.target.value })}
                        className="input-oracle h-8 text-xs"
                        placeholder="Column meaning"
                        aria-label={`Comment for ${column.column_name}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={column.ui_display || ''}
                        onChange={(event) => onColumnChange(index, { ui_display: event.target.value })}
                        className="input-oracle h-8 text-xs"
                        placeholder="Display label"
                        aria-label={`Display label for ${column.column_name}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        value={column.classification || ''}
                        onChange={(event) => onColumnChange(index, { classification: event.target.value })}
                        className="input-oracle h-8 text-xs"
                        placeholder="PII, amount, date"
                        aria-label={`Classification for ${column.column_name}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-center align-top">
                      <input
                        type="checkbox"
                        checked={Boolean(column.primary_key)}
                        onChange={(event) => onColumnChange(index, { primary_key: event.target.checked })}
                        className="mt-2 h-4 w-4 rounded border-gray-300 text-oracle-red accent-oracle-red focus:ring-oracle-red"
                        aria-label={`Primary key ${column.column_name}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
