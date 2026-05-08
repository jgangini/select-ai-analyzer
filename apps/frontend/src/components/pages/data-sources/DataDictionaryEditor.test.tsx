import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DataDictionaryEditor } from './DataDictionaryEditor';

describe('DataDictionaryEditor', () => {
  it('exposes editable metadata fields with accessible names', () => {
    const onTableCommentChange = vi.fn();
    const onColumnChange = vi.fn();

    render(
      <DataDictionaryEditor
        tableComment="Customer account data"
        columns={[
          {
            column_name: 'ACCOUNT_ID',
            data_type: 'VARCHAR2',
            data_length: 30,
            comment: 'Account key',
            ui_display: 'Account',
            classification: 'identifier',
            primary_key: true,
          },
        ]}
        onTableCommentChange={onTableCommentChange}
        onColumnChange={onColumnChange}
        renderLoadingState={() => <span>Loading metadata</span>}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /table comment/i }), {
      target: { value: 'Updated table comment' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /comment for account_id/i }), {
      target: { value: 'Updated column comment' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /display label for account_id/i }), {
      target: { value: 'Account number' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /classification for account_id/i }), {
      target: { value: 'business key' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /primary key account_id/i }));

    expect(onTableCommentChange).toHaveBeenCalledWith('Updated table comment');
    expect(onColumnChange).toHaveBeenCalledWith(0, { comment: 'Updated column comment' });
    expect(onColumnChange).toHaveBeenCalledWith(0, { ui_display: 'Account number' });
    expect(onColumnChange).toHaveBeenCalledWith(0, { classification: 'business key' });
    expect(onColumnChange).toHaveBeenCalledWith(0, { primary_key: false });
  });

  it('uses the provided loading renderer while metadata is loading', () => {
    render(
      <DataDictionaryEditor
        tableComment=""
        columns={[]}
        isLoading
        onTableCommentChange={vi.fn()}
        onColumnChange={vi.fn()}
        renderLoadingState={() => <span>Loading metadata</span>}
      />
    );

    expect(screen.getByText('Loading metadata')).toBeInTheDocument();
  });
});
