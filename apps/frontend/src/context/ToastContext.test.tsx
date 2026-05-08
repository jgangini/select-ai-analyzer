import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, ToastViewport, useToast } from './ToastContext';

function ToastProbe() {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast('Saved settings.', 'success')}>
      show toast
    </button>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows toast messages and removes dismissed toasts after the exit delay', () => {
    render(
      <ToastProvider>
        <ToastProbe />
        <ToastViewport />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'show toast' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Saved settings.');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('alert')).toHaveClass('toast-exit');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
