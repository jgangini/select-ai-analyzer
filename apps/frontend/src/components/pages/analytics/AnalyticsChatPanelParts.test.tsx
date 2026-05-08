import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsChatComposer, AnalyticsChatHeader } from './AnalyticsChatPanelParts';

describe('AnalyticsChatPanelParts', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps inline rename active and blocks duplicate rename actions', () => {
    const onRenameDraftChange = vi.fn();
    const onStartRename = vi.fn();

    render(
      <AnalyticsChatHeader
        title="Daily balance"
        currentConversationId="conversation-1"
        isHeaderMenuOpen
        isInlineRenaming
        renameDraft="Daily balance"
        isRenaming={false}
        isDeleting={false}
        isGraphPanelOpen={false}
        hasLatestResult
        dashboardDraftCount={1}
        headerMenuRef={createRef<HTMLDivElement>()}
        titleInputRef={createRef<HTMLInputElement>()}
        onRenameDraftChange={onRenameDraftChange}
        onRenameBlur={vi.fn()}
        onRenameKeyDown={vi.fn()}
        onStartRename={onStartRename}
        onToggleHeaderMenu={vi.fn()}
        onToggleDashboardTray={vi.fn()}
        onToggleGraphPanel={vi.fn()}
        onDeleteRequest={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /chat title/i }), {
      target: { value: 'Updated balance' },
    });

    expect(screen.getByRole('menuitem', { name: /rename chat/i })).toBeDisabled();
    expect(onRenameDraftChange).toHaveBeenCalledWith('Updated balance');
    expect(onStartRename).not.toHaveBeenCalled();
  });

  it('submits composer text from Enter and the send button only when text is present', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <AnalyticsChatComposer value="" placeholder="Ask about your data" isPending={false} onChange={onChange} onSubmit={onSubmit} />
    );

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    rerender(
      <AnalyticsChatComposer value="Show deposits" placeholder="Ask about your data" isPending={false} onChange={onChange} onSubmit={onSubmit} />
    );

    const composer = screen.getByRole('textbox', { name: /ask about your data/i });
    fireEvent.change(composer, { target: { value: 'Show accounts' } });
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: false });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onChange).toHaveBeenCalledWith('Show accounts');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
