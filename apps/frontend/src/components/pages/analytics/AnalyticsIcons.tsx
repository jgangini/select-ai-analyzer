import {
  ChartNetwork,
  FileCode2,
  LockKeyhole,
  MoreVertical,
  PencilLine,
  RefreshCw,
  Share2,
  Trash2,
  UsersRound,
} from 'lucide-react';

type AnalyticsIconProps = {
  className?: string;
};

function renderIcon(Icon: typeof Trash2, className: string) {
  return <Icon aria-hidden="true" className={className} focusable="false" strokeWidth={2} />;
}

export function TrashIcon({ className = 'h-4 w-4' }: AnalyticsIconProps) {
  return renderIcon(Trash2, className);
}

export function MoreVerticalIcon({ className = 'h-5 w-5' }: AnalyticsIconProps) {
  return renderIcon(MoreVertical, className);
}

export function RenameIcon({ className = 'h-4 w-4' }: AnalyticsIconProps) {
  return renderIcon(PencilLine, className);
}

export function RefreshIcon({ className = 'h-4 w-4' }: AnalyticsIconProps) {
  return renderIcon(RefreshCw, className);
}

export function SqlIcon({ className = 'h-4 w-4' }: AnalyticsIconProps) {
  return renderIcon(FileCode2, className);
}

export function GraphIcon({ className = 'h-4 w-4' }: AnalyticsIconProps) {
  return renderIcon(ChartNetwork, className);
}

export function ShareIcon({ className = 'h-4 w-4' }: AnalyticsIconProps) {
  return renderIcon(Share2, className);
}

export type DashboardVisibility = 'private' | 'shared';

export function DashboardVisibilityIcon({
  visibility,
  className = 'h-4 w-4',
}: {
  visibility: DashboardVisibility;
  className?: string;
}) {
  if (visibility === 'shared') {
    return renderIcon(UsersRound, className);
  }

  return renderIcon(LockKeyhole, className);
}
