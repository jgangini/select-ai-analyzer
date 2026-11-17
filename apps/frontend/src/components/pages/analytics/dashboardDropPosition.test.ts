import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type DashboardLayoutItem,
  getDashboardItemMoveUpdate,
  getDashboardItemColumn,
  getDropPositionAtPoint,
  getElementDropColumn,
  getVisualizationWidth,
  isDragBlockedTarget,
} from './dashboardDropPosition';

const elementFromPointMock = vi.fn();
Object.defineProperty(document, 'elementFromPoint', {
  configurable: true,
  value: elementFromPointMock,
});

function dashboardItem(id: string, width: 'half' | 'full' = 'half', order = 0): DashboardLayoutItem & { order: number } {
  return {
    dashboard_item_id: id,
    order,
    layout: { width },
  };
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function setRect(element: HTMLElement, value: DOMRect) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(value);
}

function createGrid() {
  const grid = document.createElement('div');
  grid.dataset.dashboardGrid = 'true';
  document.body.appendChild(grid);
  setRect(grid, rect(100, 100, 600, 500));
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ gridTemplateColumns: '1fr 1fr' } as CSSStyleDeclaration);
  return grid;
}

function createDashboardElement(id: string, bounds: DOMRect) {
  const element = document.createElement('article');
  element.dataset.dashboardItemId = id;
  setRect(element, bounds);
  return element;
}

afterEach(() => {
  vi.restoreAllMocks();
  elementFromPointMock.mockReset();
  document.body.innerHTML = '';
});

describe('dashboard drop positioning', () => {
  it('reads visualization width from item layout', () => {
    expect(getVisualizationWidth(dashboardItem('half'))).toBe('half');
    expect(getVisualizationWidth(dashboardItem('full', 'full'))).toBe('full');
  });

  it('infers dashboard columns from half-width item order', () => {
    const items = [
      dashboardItem('one', 'half', 0),
      dashboardItem('two', 'half', 1),
      dashboardItem('three', 'full', 2),
      dashboardItem('four', 'half', 3),
    ];

    expect(getDashboardItemColumn(items, 0)).toBe('left');
    expect(getDashboardItemColumn(items, 1)).toBe('right');
    expect(getDashboardItemColumn(items, 2)).toBe('full');
    expect(getDashboardItemColumn(items, 3)).toBe('left');
  });

  it('classifies DOM item columns from grid geometry', () => {
    const grid = createGrid();
    const leftItem = createDashboardElement('left', rect(100, 120, 280, 120));
    const rightItem = createDashboardElement('right', rect(420, 120, 280, 120));
    const fullItem = createDashboardElement('full', rect(100, 260, 600, 120));
    grid.append(leftItem, rightItem, fullItem);

    expect(getElementDropColumn(leftItem, grid)).toBe('left');
    expect(getElementDropColumn(rightItem, grid)).toBe('right');
    expect(getElementDropColumn(fullItem, grid)).toBe('full');
  });

  it('blocks drag starts from interactive or explicitly marked elements', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <article>
        <button id="button">Open</button>
        <span id="marked" data-no-card-drag="true">No drag</span>
        <span id="plain">Drag</span>
      </article>
    `;
    document.body.appendChild(container);

    expect(isDragBlockedTarget(container.querySelector('#button'))).toBe(true);
    expect(isDragBlockedTarget(container.querySelector('#marked'))).toBe(true);
    expect(isDragBlockedTarget(container.querySelector('#plain'))).toBe(false);
    expect(isDragBlockedTarget(null)).toBe(false);
  });

  it('returns full-width insertion before or after when the pointer is near item edges', () => {
    const grid = createGrid();
    const item = createDashboardElement('one', rect(100, 120, 600, 160));
    grid.append(item);
    elementFromPointMock.mockReturnValue(item);

    expect(
      getDropPositionAtPoint({
        clientX: 240,
        clientY: 130,
        dashboardItems: [dashboardItem('one', 'full')],
        activeDragItemId: null,
      })
    ).toMatchObject({ targetItemId: 'one', insertionIndex: 0, width: 'full', placement: 'before' });

    expect(
      getDropPositionAtPoint({
        clientX: 240,
        clientY: 270,
        dashboardItems: [dashboardItem('one', 'full')],
        activeDragItemId: null,
      })
    ).toMatchObject({ targetItemId: 'one', insertionIndex: 1, width: 'full', placement: 'after' });
  });

  it('returns half-width insertion from the left or right side of an item', () => {
    const grid = createGrid();
    const item = createDashboardElement('one', rect(100, 120, 280, 160));
    grid.append(item);
    elementFromPointMock.mockReturnValue(item);

    expect(
      getDropPositionAtPoint({
        clientX: 120,
        clientY: 190,
        dashboardItems: [dashboardItem('one')],
        activeDragItemId: null,
      })
    ).toMatchObject({ targetItemId: 'one', insertionIndex: 0, width: 'half', placement: 'before' });

    expect(
      getDropPositionAtPoint({
        clientX: 360,
        clientY: 190,
        dashboardItems: [dashboardItem('one')],
        activeDragItemId: null,
      })
    ).toMatchObject({ targetItemId: 'one', insertionIndex: 1, width: 'half', placement: 'after' });
  });

  it('falls back to appending after the last item below the grid content', () => {
    const grid = createGrid();
    const first = createDashboardElement('one', rect(100, 120, 280, 120));
    const second = createDashboardElement('two', rect(420, 120, 280, 120));
    grid.append(first, second);
    elementFromPointMock.mockReturnValue(grid);

    expect(
      getDropPositionAtPoint({
        clientX: 300,
        clientY: 255,
        dashboardItems: [dashboardItem('one'), dashboardItem('two')],
        activeDragItemId: null,
      })
    ).toMatchObject({ targetItemId: 'two', insertionIndex: 2, width: 'full', placement: 'after' });
  });
});

describe('dashboard item move updates', () => {
  const items = [dashboardItem('one'), dashboardItem('two'), dashboardItem('three')];

  it('returns null when the drop position has no insertion target', () => {
    expect(
      getDashboardItemMoveUpdate(items, 'two', {
        targetItemId: null,
        targetIndex: null,
        insertionIndex: null,
        width: 'full',
        placement: 'before',
        targetColumn: 'full',
      })
    ).toBeNull();
  });

  it('returns reordered item ids when the item changes position', () => {
    expect(
      getDashboardItemMoveUpdate(items, 'three', {
        targetItemId: 'one',
        targetIndex: 0,
        insertionIndex: 0,
        width: 'half',
        placement: 'before',
        targetColumn: 'left',
      })
    ).toMatchObject({
      item: items[2],
      itemIds: ['three', 'one', 'two'],
      width: 'half',
    });
  });

  it('returns a width-only update when order stays the same', () => {
    expect(
      getDashboardItemMoveUpdate(items, 'two', {
        targetItemId: 'two',
        targetIndex: 1,
        insertionIndex: 2,
        width: 'full',
        placement: 'after',
        targetColumn: 'right',
      })
    ).toMatchObject({
      item: items[1],
      itemIds: null,
      width: 'full',
    });
  });

  it('returns null when the computed move would not change order or width', () => {
    expect(
      getDashboardItemMoveUpdate(items, 'two', {
        targetItemId: 'two',
        targetIndex: 1,
        insertionIndex: 2,
        width: 'half',
        placement: 'after',
        targetColumn: 'right',
      })
    ).toBeNull();
  });
});
