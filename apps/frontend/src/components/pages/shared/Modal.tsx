import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: ReactNode;
  className?: string;
  zIndex?: string;
  onBackdropClick?: () => void;
}

function ModalPortal({
  children,
  className = '',
  zIndex = 'z-50',
  onBackdropClick,
}: ModalPortalProps) {
  return createPortal(
    <div
      className={`fixed inset-0 m-0 bg-black/30 backdrop-blur-sm flex items-center justify-center ${zIndex} ${className}`}
      onClick={onBackdropClick}
    >
      {children}
    </div>,
    document.body
  );
}

interface ConfirmModalProps {
  icon: ReactNode;
  iconBg?: string;
  iconRing?: string;
  title: string;
  message: ReactNode;
  detail?: string;
  confirmText: string;
  confirmClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  loadingText?: string;
}

export function ConfirmModal({
  icon,
  iconBg = 'bg-gray-100',
  iconRing = 'ring-gray-50',
  title,
  message,
  detail,
  confirmText,
  confirmClass = 'text-oracle-red hover:bg-red-50',
  onConfirm,
  onCancel,
  loading = false,
  loadingText = 'Processing...',
}: ConfirmModalProps) {
  return (
    <ModalPortal>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex w-full min-w-0 flex-col items-center pt-8 pb-6 px-6 text-center">
          <div className={`w-20 h-20 rounded-full ${iconBg} flex items-center justify-center mb-5 ring-8 ${iconRing}`}>
            {icon}
          </div>
          <h2 className="text-xl font-bold text-oracle-dark-gray">{title}</h2>
          <div className="mt-2 w-full min-w-0 max-w-full text-sm leading-relaxed text-oracle-medium-gray">
            {message}
          </div>
          {detail && (
            <p className="text-xs text-oracle-light-gray mt-1">{detail}</p>
          )}
        </div>
        <div className="flex">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-4 text-sm font-medium text-oracle-medium-gray hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <div className="w-px bg-gray-100" />
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-4 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmClass}`}
          >
            {loading ? loadingText : confirmText}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

interface ConfirmDeleteModalProps {
  title: string;
  message: ReactNode;
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDeleteModal({
  title,
  message,
  detail,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDeleteModalProps) {
  return (
    <ConfirmModal
      icon={
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      }
      iconBg="bg-red-100"
      iconRing="ring-red-50"
      title={title}
      message={message}
      detail={detail}
      confirmText="Delete"
      confirmClass="bg-oracle-red text-white hover:bg-oracle-red/90"
      loadingText="Deleting..."
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}

export function ConfirmQuestionModal({
  title,
  message,
  detail,
  confirmText,
  confirmClass = 'text-red-600 hover:bg-red-50',
  onConfirm,
  onCancel,
  loading = false,
  loadingText = 'Processing...',
}: Omit<ConfirmModalProps, 'icon'>) {
  return (
    <ConfirmModal
      icon={
        <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      }
      iconBg="bg-red-100"
      iconRing="ring-red-50"
      title={title}
      message={message}
      detail={detail}
      confirmText={confirmText}
      confirmClass={confirmClass}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
      loadingText={loadingText}
    />
  );
}

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: string;
  containerClassName?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
}

export function GlassModal({
  open,
  onClose,
  children,
  zIndex = 'z-[300]',
  containerClassName = 'items-start justify-center p-4',
  panelClassName = '',
  panelStyle,
}: GlassModalProps) {
  if (!open) return null;

  return (
    <ModalPortal zIndex={zIndex} className={containerClassName} onBackdropClick={onClose}>
      <div
        className={`rounded-2xl shadow-2xl border border-white/20 overflow-hidden ${panelClassName}`}
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          ...panelStyle,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </ModalPortal>
  );
}
