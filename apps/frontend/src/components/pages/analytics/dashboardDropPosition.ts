export type VisualizationWidth = 'half' | 'full';
export type DropPlacement = 'before' | 'after';
export type DropColumn = 'left' | 'right' | 'full';

export type DropPosition = {
  targetItemId: string | null;
  targetIndex: number | null;
  insertionIndex: number | null;
  width: VisualizationWidth;
  placement: DropPlacement;
  targetColumn: DropColumn;
};

export type DashboardLayoutItem = {
  dashboard_item_id: string;
  layout?: Record<string, unknown> | null;
};

type DropPositionInput = {
  clientX: number;
  clientY: number;
  dashboardItems: DashboardLayoutItem[];
  activeDragItemId: string | null;
};

export type DashboardItemMoveUpdate = {
  item: DashboardLayoutItem;
  itemIds: string[] | null;
  width: VisualizationWidth;
};

const GRID_X_MARGIN = 32;
const GRID_Y_MARGIN = 56;
const FULL_WIDTH_RATIO = 0.75;
const ROW_PARTNER_OVERLAP_RATIO = 0.45;
const EDGE_BEFORE_RATIO = 0.24;
const EDGE_AFTER_RATIO = 0.76;

const EMPTY_DROP_POSITION: DropPosition = {
  targetItemId: null,
  targetIndex: null,
  insertionIndex: null,
  width: 'full',
  placement: 'before',
  targetColumn: 'full',
};

export function getVisualizationWidth(item: DashboardLayoutItem): VisualizationWidth {
  return item.layout?.width === 'full' ? 'full' : 'half';
}

export function isDragBlockedTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest(
      'button, input, select, textarea, a, [role="menu"], [contenteditable="true"], [data-no-card-drag="true"]'
    )
  );
}

export function getElementDropColumn(itemElement: HTMLElement, gridElement: HTMLElement | null): DropColumn {
  if (!gridElement) return 'full';
  const itemRect = itemElement.getBoundingClientRect();
  const gridRect = gridElement.getBoundingClientRect();
  if (itemRect.width >= gridRect.width * FULL_WIDTH_RATIO) return 'full';
  return itemRect.left + itemRect.width / 2 < gridRect.left + gridRect.width / 2 ? 'left' : 'right';
}

export function getDashboardItemColumn(items: DashboardLayoutItem[], itemIndex: number): DropColumn {
  let openColumn: DropColumn = 'left';

  for (let index = 0; index <= itemIndex; index += 1) {
    const width = getVisualizationWidth(items[index]);
    if (width === 'full') {
      if (index === itemIndex) return 'full';
      openColumn = 'left';
      continue;
    }

    const column = openColumn;
    if (index === itemIndex) return column;
    openColumn = openColumn === 'left' ? 'right' : 'left';
  }

  return 'full';
}

export function getDashboardItemMoveUpdate(
  dashboardItems: DashboardLayoutItem[],
  itemId: string,
  dropPosition: DropPosition
): DashboardItemMoveUpdate | null {
  if (dropPosition.insertionIndex === null) return null;

  const itemIds = dashboardItems.map((item) => item.dashboard_item_id);
  const currentIndex = itemIds.indexOf(itemId);
  const item = dashboardItems[currentIndex];
  if (currentIndex < 0 || !item) return null;

  const nextItemIds = itemIds.filter((id) => id !== itemId);
  const nextIndex = Math.max(
    0,
    Math.min(
      dropPosition.insertionIndex > currentIndex ? dropPosition.insertionIndex - 1 : dropPosition.insertionIndex,
      nextItemIds.length
    )
  );
  nextItemIds.splice(nextIndex, 0, itemId);

  const orderChanged = nextItemIds.some((id, index) => id !== itemIds[index]);
  const widthChanged = getVisualizationWidth(item) !== dropPosition.width;
  if (!orderChanged && !widthChanged) return null;

  return {
    item,
    itemIds: orderChanged ? nextItemIds : null,
    width: dropPosition.width,
  };
}

export function getDropPositionAtPoint(input: DropPositionInput): DropPosition {
  const gridElement = document.querySelector<HTMLElement>('[data-dashboard-grid="true"]');
  const itemElements = getDashboardItemElements(gridElement);
  const elementAtPoint = document.elementFromPoint(input.clientX, input.clientY) as HTMLElement | null;
  const dropZonePosition = getDropZonePosition(elementAtPoint, gridElement, itemElements, input.dashboardItems);
  if (dropZonePosition) return dropZonePosition;

  const itemElement = elementAtPoint?.closest<HTMLElement>('[data-dashboard-item-id]');
  const targetItemId = itemElement?.dataset.dashboardItemId || null;
  const targetIndex = findDashboardItemIndex(input.dashboardItems, targetItemId);
  if (!itemElement || !targetItemId || targetIndex < 0) {
    return getGridFallbackDropPosition({ ...input, gridElement, itemElements });
  }

  return getItemDropPosition({
    clientX: input.clientX,
    clientY: input.clientY,
    itemElement,
    targetItemId,
    targetIndex,
  });
}

function getDashboardItemElements(gridElement: HTMLElement | null): HTMLElement[] {
  return gridElement ? Array.from(gridElement.querySelectorAll<HTMLElement>('[data-dashboard-item-id]')) : [];
}

function findDashboardItemIndex(items: DashboardLayoutItem[], itemId: string | null): number {
  return itemId ? items.findIndex((item) => item.dashboard_item_id === itemId) : -1;
}

function getDropZonePosition(
  elementAtPoint: HTMLElement | null,
  gridElement: HTMLElement | null,
  itemElements: HTMLElement[],
  dashboardItems: DashboardLayoutItem[]
): DropPosition | null {
  const dropZoneElement = elementAtPoint?.closest<HTMLElement>('[data-dashboard-drop-zone-target-id]');
  if (!dropZoneElement || !gridElement) return null;

  const targetItemId = dropZoneElement.dataset.dashboardDropZoneTargetId || null;
  const targetIndex = findDashboardItemIndex(dashboardItems, targetItemId);
  const targetElement = itemElements.find((element) => element.dataset.dashboardItemId === targetItemId);
  if (!targetItemId || targetIndex < 0) return null;

  return {
    targetItemId,
    targetIndex,
    insertionIndex: targetIndex + 1,
    width: 'half',
    placement: 'after',
    targetColumn: targetElement ? getElementDropColumn(targetElement, gridElement) : 'left',
  };
}

function getGridFallbackDropPosition({
  clientX,
  clientY,
  dashboardItems,
  activeDragItemId,
  gridElement,
  itemElements,
}: DropPositionInput & {
  gridElement: HTMLElement | null;
  itemElements: HTMLElement[];
}): DropPosition {
  if (!gridElement || itemElements.length === 0) return EMPTY_DROP_POSITION;

  const gridRect = gridElement.getBoundingClientRect();
  if (!isNearGrid(clientX, clientY, gridRect)) return EMPTY_DROP_POSITION;

  const rowGapPosition = getRowGapDropPosition({
    clientX,
    clientY,
    dashboardItems,
    activeDragItemId,
    gridElement,
    gridRect,
    itemElements,
  });
  if (rowGapPosition) return rowGapPosition;

  const firstElement = itemElements[0];
  const lastElement = itemElements[itemElements.length - 1];
  const firstRect = firstElement.getBoundingClientRect();
  const lastRect = lastElement.getBoundingClientRect();
  if (clientY < firstRect.top) return buildEdgeDropPosition(firstElement, 0, 0, 'before', gridElement);
  if (clientY > lastRect.bottom) {
    return buildEdgeDropPosition(lastElement, dashboardItems.length - 1, dashboardItems.length, 'after', gridElement);
  }

  return getNearestDropPosition(clientY, dashboardItems, gridElement, itemElements);
}

function isNearGrid(clientX: number, clientY: number, gridRect: DOMRect): boolean {
  return (
    clientX >= gridRect.left - GRID_X_MARGIN &&
    clientX <= gridRect.right + GRID_X_MARGIN &&
    clientY >= gridRect.top - GRID_Y_MARGIN &&
    clientY <= gridRect.bottom + GRID_Y_MARGIN
  );
}

function getGridColumnCount(gridElement: HTMLElement): number {
  return getComputedStyle(gridElement).gridTemplateColumns.split(' ').filter(Boolean).length;
}

function getRowGapDropPosition({
  clientX,
  clientY,
  dashboardItems,
  activeDragItemId,
  gridElement,
  gridRect,
  itemElements,
}: DropPositionInput & {
  gridElement: HTMLElement;
  gridRect: DOMRect;
  itemElements: HTMLElement[];
}): DropPosition | null {
  if (getGridColumnCount(gridElement) <= 1) return null;
  const rowElement = findOpenRowElement(clientX, clientY, activeDragItemId, gridElement, gridRect, itemElements);
  if (!rowElement) return null;
  return buildRowGapPosition(clientX, dashboardItems, gridElement, gridRect, rowElement);
}

function findOpenRowElement(
  clientX: number,
  clientY: number,
  activeDragItemId: string | null,
  gridElement: HTMLElement,
  gridRect: DOMRect,
  itemElements: HTMLElement[]
): HTMLElement | null {
  const halfItemElements = itemElements.filter((candidate) =>
    isActiveHalfItem(candidate, clientY, activeDragItemId, gridRect)
  );
  return (
    halfItemElements.find((candidate) => {
      if (hasRowPartner(candidate, activeDragItemId, itemElements, gridRect)) return false;
      return isPointerInOpenColumnGap(clientX, candidate, gridElement, gridRect);
    }) || null
  );
}

function isActiveHalfItem(
  element: HTMLElement,
  clientY: number,
  activeDragItemId: string | null,
  gridRect: DOMRect
): boolean {
  const rect = element.getBoundingClientRect();
  return (
    element.dataset.dashboardItemId !== activeDragItemId &&
    rect.width < gridRect.width * FULL_WIDTH_RATIO &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function hasRowPartner(
  candidate: HTMLElement,
  activeDragItemId: string | null,
  itemElements: HTMLElement[],
  gridRect: DOMRect
): boolean {
  const candidateRect = candidate.getBoundingClientRect();
  return itemElements.some((other) => {
    if (other === candidate || other.dataset.dashboardItemId === activeDragItemId) return false;
    const otherRect = other.getBoundingClientRect();
    if (otherRect.width >= gridRect.width * FULL_WIDTH_RATIO) return false;
    const overlap = Math.min(candidateRect.bottom, otherRect.bottom) - Math.max(candidateRect.top, otherRect.top);
    return overlap > Math.min(candidateRect.height, otherRect.height) * ROW_PARTNER_OVERLAP_RATIO;
  });
}

function isPointerInOpenColumnGap(
  clientX: number,
  element: HTMLElement,
  gridElement: HTMLElement,
  gridRect: DOMRect
): boolean {
  const rect = element.getBoundingClientRect();
  const column = getElementDropColumn(element, gridElement);
  return column === 'left'
    ? clientX > rect.right && clientX <= gridRect.right + GRID_X_MARGIN
    : clientX < rect.left && clientX >= gridRect.left - GRID_X_MARGIN;
}

function buildRowGapPosition(
  clientX: number,
  dashboardItems: DashboardLayoutItem[],
  gridElement: HTMLElement,
  gridRect: DOMRect,
  rowElement: HTMLElement
): DropPosition | null {
  const targetItemId = rowElement.dataset.dashboardItemId || null;
  const targetIndex = findDashboardItemIndex(dashboardItems, targetItemId);
  if (!targetItemId || targetIndex < 0) return null;

  const rowRect = rowElement.getBoundingClientRect();
  const targetColumn = getElementDropColumn(rowElement, gridElement);
  if (targetColumn === 'left' && clientX > rowRect.right && clientX <= gridRect.right + GRID_X_MARGIN) {
    return buildDropPosition(targetItemId, targetIndex, targetIndex + 1, 'half', 'after', targetColumn);
  }
  if (targetColumn === 'right' && clientX < rowRect.left && clientX >= gridRect.left - GRID_X_MARGIN) {
    return buildDropPosition(targetItemId, targetIndex, targetIndex, 'half', 'before', targetColumn);
  }
  return null;
}

function buildEdgeDropPosition(
  element: HTMLElement,
  targetIndex: number,
  insertionIndex: number,
  placement: DropPlacement,
  gridElement: HTMLElement
): DropPosition {
  return buildDropPosition(
    element.dataset.dashboardItemId || null,
    targetIndex,
    insertionIndex,
    'full',
    placement,
    getElementDropColumn(element, gridElement)
  );
}

function getNearestDropPosition(
  clientY: number,
  dashboardItems: DashboardLayoutItem[],
  gridElement: HTMLElement,
  itemElements: HTMLElement[]
): DropPosition {
  const nearestElement = itemElements.reduce((nearest, candidate) => {
    const nearestRect = nearest.getBoundingClientRect();
    const candidateRect = candidate.getBoundingClientRect();
    const nearestDistance = Math.abs(clientY - (nearestRect.top + nearestRect.height / 2));
    const candidateDistance = Math.abs(clientY - (candidateRect.top + candidateRect.height / 2));
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, itemElements[0]);
  const targetItemId = nearestElement.dataset.dashboardItemId || null;
  const targetIndex = findDashboardItemIndex(dashboardItems, targetItemId);
  if (!targetItemId || targetIndex < 0) return EMPTY_DROP_POSITION;

  const nearestRect = nearestElement.getBoundingClientRect();
  const placement: DropPlacement = clientY < nearestRect.top + nearestRect.height / 2 ? 'before' : 'after';
  return buildDropPosition(
    targetItemId,
    targetIndex,
    targetIndex + (placement === 'before' ? 0 : 1),
    'full',
    placement,
    getElementDropColumn(nearestElement, gridElement)
  );
}

function getItemDropPosition({
  clientX,
  clientY,
  itemElement,
  targetItemId,
  targetIndex,
}: Pick<DropPositionInput, 'clientX' | 'clientY'> & {
  itemElement: HTMLElement;
  targetItemId: string;
  targetIndex: number;
}): DropPosition {
  const rect = itemElement.getBoundingClientRect();
  const targetGridElement = itemElement.parentElement;
  const columnCount = targetGridElement ? getGridColumnCount(targetGridElement) : 2;
  const targetColumn = getElementDropColumn(itemElement, targetGridElement);
  const verticalRatio = (clientY - rect.top) / Math.max(rect.height, 1);
  if (verticalRatio < EDGE_BEFORE_RATIO) {
    return buildDropPosition(targetItemId, targetIndex, targetIndex, 'full', 'before', targetColumn);
  }
  if (verticalRatio > EDGE_AFTER_RATIO) {
    return buildDropPosition(targetItemId, targetIndex, targetIndex + 1, 'full', 'after', targetColumn);
  }

  const isBeforeTarget =
    columnCount <= 1 ? clientY < rect.top + rect.height / 2 : clientX < rect.left + rect.width / 2;
  const placement: DropPlacement = isBeforeTarget ? 'before' : 'after';
  return buildDropPosition(
    targetItemId,
    targetIndex,
    targetIndex + (isBeforeTarget ? 0 : 1),
    'half',
    placement,
    targetColumn
  );
}

function buildDropPosition(
  targetItemId: string | null,
  targetIndex: number | null,
  insertionIndex: number | null,
  width: VisualizationWidth,
  placement: DropPlacement,
  targetColumn: DropColumn
): DropPosition {
  return { targetItemId, targetIndex, insertionIndex, width, placement, targetColumn };
}
