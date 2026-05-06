import type { ReactNode } from 'react';

import { ConfirmModal } from './ConfirmModal';

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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0l1 12h6l1-12M10 11v6m4-6v6" />
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
