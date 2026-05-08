import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const MIN_CHART_SCROLL_THUMB_PX = 48;

type ChartSortMode = 'original' | 'value-desc' | 'value-asc' | 'label-asc' | 'label-desc';

type ChartScrollbarState = {
  show: boolean;
  width: number;
  left: number;
};

function measureScrollFrameScrollbar(
  element: Pick<HTMLDivElement, 'clientWidth' | 'scrollWidth' | 'scrollLeft'> | null
): ChartScrollbarState {
  if (!element || element.scrollWidth <= element.clientWidth + 1) {
    return { show: false, width: MIN_CHART_SCROLL_THUMB_PX, left: 0 };
  }

  const ratio = element.clientWidth / element.scrollWidth;
  const width = Math.max(MIN_CHART_SCROLL_THUMB_PX, element.clientWidth * ratio);
  const maxScrollLeft = Math.max(1, element.scrollWidth - element.clientWidth);
  const maxThumbLeft = Math.max(0, element.clientWidth - width);
  return { show: true, width, left: (element.scrollLeft / maxScrollLeft) * maxThumbLeft };
}

export function AddVisualizationButton({
  visibleCount,
  totalCount,
  isVisualizationAdded,
  onAddVisualization,
}: {
  visibleCount: number;
  totalCount: number;
  isVisualizationAdded?: boolean;
  onAddVisualization: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border text-lg font-semibold transition-colors ${
        isVisualizationAdded
          ? 'border-gray-300 bg-gray-50 text-oracle-medium-gray'
          : 'border-gray-300 bg-white text-oracle-medium-gray hover:border-gray-400 hover:bg-gray-50 hover:text-oracle-dark-gray'
      }`}
      onClick={onAddVisualization}
      disabled={isVisualizationAdded}
      title={isVisualizationAdded ? 'Visualization already added' : `${visibleCount} of ${totalCount} values. Add visualization`}
      aria-label={isVisualizationAdded ? 'Visualization already added' : 'Add visualization'}
      data-testid="add-visualization-button"
    >
      {isVisualizationAdded ? (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span aria-hidden="true">+</span>
      )}
    </button>
  );
}

type ChartControlsProps = {
  search: string;
  sortMode: ChartSortMode;
  visibleCount: number;
  totalCount: number;
  isVisualizationAdded?: boolean;
  onSearchChange: (value: string) => void;
  onSortModeChange: (value: ChartSortMode) => void;
  onAddVisualization?: () => void;
};

function ChartFilterControls({
  search,
  sortMode,
  onSearchChange,
  onSortModeChange,
}: Pick<ChartControlsProps, 'search' | 'sortMode' | 'onSearchChange' | 'onSortModeChange'>) {
  return (
    <>
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
        placeholder="Filter chart values..."
        aria-label="Filter chart values"
        data-testid="analytics-chart-filter"
      />
      <select
        value={sortMode}
        onChange={(event) => onSortModeChange(event.target.value as ChartSortMode)}
        className="input-oracle h-9 min-w-0 rounded-lg py-1.5 text-xs"
        aria-label="Sort chart values"
        data-testid="analytics-chart-sort"
      >
        <option value="original">Original order</option>
        <option value="value-desc">Highest first</option>
        <option value="value-asc">Lowest first</option>
        <option value="label-asc">Label A-Z</option>
        <option value="label-desc">Label Z-A</option>
      </select>
    </>
  );
}

function ChartActionControl({
  visibleCount,
  totalCount,
  isVisualizationAdded,
  onAddVisualization,
}: Pick<ChartControlsProps, 'visibleCount' | 'totalCount' | 'isVisualizationAdded' | 'onAddVisualization'>) {
  if (!onAddVisualization) {
    return (
      <span className="sr-only" data-testid="analytics-chart-count">
        {visibleCount} of {totalCount}
      </span>
    );
  }

  return (
    <AddVisualizationButton
      visibleCount={visibleCount}
      totalCount={totalCount}
      isVisualizationAdded={isVisualizationAdded}
      onAddVisualization={onAddVisualization}
    />
  );
}

export function ChartControls(props: ChartControlsProps) {
  if (props.totalCount <= 1 && !props.onAddVisualization) return null;

  return (
    <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_auto] sm:items-center">
      {props.totalCount > 1 ? <ChartFilterControls {...props} /> : <div className="sm:col-span-2" />}
      <ChartActionControl {...props} />
    </div>
  );
}

export function ChartScrollFrame({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [scrollbar, setScrollbar] = useState<ChartScrollbarState>({
    show: false,
    width: MIN_CHART_SCROLL_THUMB_PX,
    left: 0,
  });

  const updateScrollbar = useCallback(() => {
    setScrollbar(measureScrollFrameScrollbar(scrollRef.current));
  }, []);

  const scrollToClientX = useCallback(
    (clientX: number) => {
      const scrollElement = scrollRef.current;
      const railElement = railRef.current;
      if (!scrollElement || !railElement) return;

      const railRect = railElement.getBoundingClientRect();
      const maxThumbLeft = Math.max(0, railRect.width - scrollbar.width);
      const nextThumbLeft = Math.min(maxThumbLeft, Math.max(0, clientX - railRect.left - scrollbar.width / 2));
      const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
      scrollElement.scrollLeft = maxThumbLeft > 0 ? (nextThumbLeft / maxThumbLeft) * maxScrollLeft : 0;
      updateScrollbar();
    },
    [scrollbar.width, updateScrollbar]
  );

  const handleRailMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!scrollbar.show) return;
    event.preventDefault();
    scrollToClientX(event.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      scrollToClientX(moveEvent.clientX);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  useEffect(() => {
    updateScrollbar();
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    window.addEventListener('resize', updateScrollbar);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollbar) : null;
    resizeObserver?.observe(scrollElement);
    if (scrollElement.firstElementChild) resizeObserver?.observe(scrollElement.firstElementChild);

    return () => {
      window.removeEventListener('resize', updateScrollbar);
      resizeObserver?.disconnect();
    };
  }, [children, updateScrollbar]);

  return (
    <div className="chart-scroll-shell">
      <div
        ref={scrollRef}
        className="chart-horizontal-scroll overflow-x-scroll overflow-y-hidden pb-3"
        data-testid="analytics-chart-scroll"
        onScroll={updateScrollbar}
      >
        {children}
      </div>
      <div
        ref={railRef}
        aria-hidden="true"
        className={`chart-horizontal-scroll-rail ${scrollbar.show ? 'opacity-100' : 'opacity-0'}`}
        data-testid="analytics-chart-scroll-rail"
        onMouseDown={handleRailMouseDown}
      >
        <span
          className="chart-horizontal-scroll-thumb"
          style={{
            width: `${scrollbar.width}px`,
            transform: `translateX(${scrollbar.left}px)`,
          }}
        />
      </div>
    </div>
  );
}
