import { createRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsChatComposer, AnalyticsChatHeader, AnalyticsSuggestedQuestionButtons } from './AnalyticsChatPanelParts';

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
        isProcessing={false}
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

  it('disables chat deletion while the current chat is processing', () => {
    const onDeleteRequest = vi.fn();

    render(
      <AnalyticsChatHeader
        title="Daily balance"
        currentConversationId="conversation-1"
        isHeaderMenuOpen
        isInlineRenaming={false}
        renameDraft="Daily balance"
        isRenaming={false}
        isDeleting={false}
        isProcessing
        isGraphPanelOpen={false}
        hasLatestResult
        dashboardDraftCount={0}
        headerMenuRef={createRef<HTMLDivElement>()}
        titleInputRef={createRef<HTMLInputElement>()}
        onRenameDraftChange={vi.fn()}
        onRenameBlur={vi.fn()}
        onRenameKeyDown={vi.fn()}
        onStartRename={vi.fn()}
        onToggleHeaderMenu={vi.fn()}
        onToggleDashboardTray={vi.fn()}
        onToggleGraphPanel={vi.fn()}
        onDeleteRequest={onDeleteRequest}
      />
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /delete chat/i }));

    expect(screen.getByRole('menuitem', { name: /delete chat/i })).toBeDisabled();
    expect(onDeleteRequest).not.toHaveBeenCalled();
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

  it('renders suggested question buttons that populate the composer', () => {
    const onSelect = vi.fn();

    render(
      <AnalyticsSuggestedQuestionButtons
        questions={[
          'Which customers grew the most this month?',
          'Which products concentrate the most transactions?',
          'Which transactions are pending?',
        ]}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Which products concentrate the most transactions?' }));

    expect(onSelect).toHaveBeenCalledWith('Which products concentrate the most transactions?');
  });

  it('refreshes one suggested question without selecting it', () => {
    const onSelect = vi.fn();
    const onRefreshQuestion = vi.fn();

    render(
      <AnalyticsSuggestedQuestionButtons
        questions={[
          '¿Cuál es el saldo actual por moneda y sucursal?',
          '¿Qué cuentas tienen mayor saldo bloqueado?',
          '¿Qué préstamos tienen mayor deuda pendiente?',
        ]}
        onSelect={onSelect}
        onRefreshQuestion={onRefreshQuestion}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /change suggested question 2/i }));

    expect(onRefreshQuestion).toHaveBeenCalledWith(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
