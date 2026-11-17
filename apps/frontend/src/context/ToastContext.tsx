import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextType {
  showToast: (
    message: string,
    _variant?: 'success' | 'error' | 'info' | 'warning'
  ) => void;
  toasts: ToastItem[];
  exitingIds: Set<number>;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_DURATION_MS = 5000;
const TOAST_EXIT_MS = 400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());
  const idRef = useRef(0);
  const timeoutsRef = useRef<Map<number, number>>(new Map());
  const exitTimeoutsRef = useRef<Map<number, number>>(new Map());

  const removeToastAfterExit = useCallback((id: number) => {
    const t = timeoutsRef.current.get(id);
    if (t != null) {
      clearTimeout(t);
      timeoutsRef.current.delete(id);
    }
    setExitingIds((prev) => new Set([...prev, id]));
    const exitT = window.setTimeout(() => {
      exitTimeoutsRef.current.delete(id);
      setToasts((prev) => prev.filter((x) => x.id !== id));
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, TOAST_EXIT_MS);
    exitTimeoutsRef.current.set(id, exitT);
  }, []);

  const dismissToast = useCallback((id: number) => {
    removeToastAfterExit(id);
  }, [removeToastAfterExit]);

  const showToast = useCallback(
    (
      message: string,
      _variant?: 'success' | 'error' | 'info' | 'warning'
    ) => {
      void _variant;
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message }]);
      const t = window.setTimeout(() => {
        timeoutsRef.current.delete(id);
        removeToastAfterExit(id);
      }, TOAST_DURATION_MS);
      timeoutsRef.current.set(id, t);
    },
    [removeToastAfterExit]
  );

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      exitTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts, exitingIds, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function ToastViewport() {
  const { toasts, exitingIds, dismissToast } = useToast();
  if (toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-12 z-[99999] flex flex-col gap-2 max-w-sm w-full sm:max-w-md pointer-events-auto"
      aria-live="polite"
      role="region"
      aria-label="Notificaciones"
    >
      {toasts.map(({ id, message }) => (
        <div
          key={id}
          className={`rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg text-white min-h-[33px] ${exitingIds.has(id) ? 'toast-exit' : 'toast-enter'}`}
          style={{
            backgroundColor: '#2a2724',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontSize: '11px',
          }}
          role="alert"
        >
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={() => dismissToast(id)}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors font-medium leading-none text-xs"
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
