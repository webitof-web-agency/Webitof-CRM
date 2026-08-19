import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, Layers } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Select } from './Select';
import { cn } from '../../lib/cn';

function getNextSortDirection(currentKey, currentDirection, nextKey) {
  if (currentKey !== nextKey) return 'asc';
  if (currentDirection === 'asc') return 'desc';
  if (currentDirection === 'desc') return null;
  return 'asc';
}

function formatBadgeValue(value) {
  if (value == null || value === '') return '-';
  return String(value);
}

function formatTableValue(value, type) {
  if (value == null || value === '') return '-';
  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN');
  }
  if (type === 'datetime') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('en-IN');
  }
  if (type === 'currency') {
    const num = Number(value);
    return Number.isNaN(num)
      ? String(value)
      : num.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  }
  return String(value);
}

export function DataTable({
  toolbarLeft,
  toolbarRight,
  columns,
  rows,
  rowKey = 'id',
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There is nothing to show yet.',
  onCreate,
  createLabel = 'New item',
  selectable = true,
  selectedIds = [],
  onSelectedIdsChange,
  sortKey = '',
  sortDirection = null,
  onSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rowActions,
  rowClassName,
  onRowClick,
  lookups = {}
}) {
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(10);
  const currentPageSize = pageSize ?? internalPageSize;
  const totalRows = rows?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / currentPageSize));
  const currentPage = Math.min(Math.max(page ?? internalPage, 1), totalPages);
  const startIndex = (currentPage - 1) * currentPageSize;
  const visibleRows = (rows || []).slice(startIndex, startIndex + currentPageSize);
  const allVisibleSelected =
    selectable && visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row[rowKey]));

  useEffect(() => {
    if (page == null && internalPage > totalPages) {
      setInternalPage(totalPages);
    }
  }, [internalPage, page, totalPages]);

  function toggleAllVisible() {
    if (!onSelectedIdsChange) return;
    const ids = new Set(selectedIds);
    if (allVisibleSelected) {
      visibleRows.forEach((row) => ids.delete(row[rowKey]));
    } else {
      visibleRows.forEach((row) => ids.add(row[rowKey]));
    }
    onSelectedIdsChange([...ids]);
  }

  function toggleRow(id) {
    if (!onSelectedIdsChange) return;
    const ids = new Set(selectedIds);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    onSelectedIdsChange([...ids]);
  }

  function goToPage(nextPage) {
    if (onPageChange) onPageChange(nextPage);
    else setInternalPage(nextPage);
  }

  function changePageSize(nextSize) {
    if (onPageSizeChange) onPageSizeChange(nextSize);
    else {
      setInternalPageSize(nextSize);
      setInternalPage(1);
    }
  }

  if (!loading && totalRows === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={onCreate ? createLabel : ''}
        onAction={onCreate}
      />
    );
  }

  return (
    <div className="liquid-glass-card relative overflow-hidden rounded-[22px] border border-white/80 dark:border-white/10 shadow-[var(--shadow-card)] backdrop-blur-xl transition-all">
      {/* Top Specular Light Highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none z-20" />

      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-5 py-3.5 bg-white/40 dark:bg-white/[0.02]">
        {toolbarLeft ? (
          toolbarLeft
        ) : (
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Layers size={14} className="text-slate-400 dark:text-slate-500" />
              {totalRows} {totalRows === 1 ? 'record' : 'records'}
            </span>
            {selectedIds.length ? (
              <span className="rounded-full bg-[#0071E3]/15 px-2.5 py-0.5 text-xs font-bold text-[#0071E3] dark:text-[#2997FF] border border-[#0071E3]/25 backdrop-blur-md">
                {selectedIds.length} selected
              </span>
            ) : null}
          </div>
        )}
        <div className="flex items-center gap-3">
          {toolbarRight}
          <div className="w-20">
            <Select
              searchable={false}
              value={currentPageSize}
              onChange={(val) => changePageSize(Number(val))}
              options={[
                { label: '5', value: 5 },
                { label: '10', value: 10 },
                { label: '20', value: 20 },
                { label: '50', value: 50 },
                { label: '100', value: 100 }
              ]}
            />
          </div>
          {onCreate ? (
            <Button type="button" size="sm" onClick={onCreate}>
              {createLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table Body & Skeletons */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-md">
            <tr>
              {selectable ? (
                <th className="sticky left-0 z-10 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#12151e]/80 backdrop-blur-md px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-12">
                  <Checkbox
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select visible rows"
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const sorted = sortKey === column.key;
                const icon = sorted ? (
                  sortDirection === 'desc' ? (
                    <ChevronDown size={13} className="text-[var(--primary)]" />
                  ) : (
                    <ChevronUp size={13} className="text-[var(--primary)]" />
                  )
                ) : (
                  <ChevronsUpDown size={13} className="text-[var(--text-muted)] opacity-60 group-hover:opacity-100" />
                );
                const sortable = column.sortable !== false;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      'border-b border-[var(--border)] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        className="group inline-flex items-center gap-1.5 transition hover:text-[var(--text-main)] cursor-pointer"
                        onClick={() =>
                          onSortChange?.(column.key, getNextSortDirection(sortKey, sortDirection, column.key))
                        }
                      >
                        <span>{column.label}</span>
                        {icon}
                      </button>
                    ) : (
                      <span>{column.label}</span>
                    )}
                  </th>
                );
              })}
              {rowActions ? (
                <th className="border-b border-[var(--border)] px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(currentPageSize, 5) }).map((_, idx) => (
                <tr key={idx} className="border-b border-[var(--border-muted)]">
                  {selectable ? (
                    <td className="px-4 py-3.5 border-b border-[var(--border-muted)]">
                      <div className="h-4 w-4 rounded bg-[var(--surface-3)] animate-pulse" />
                    </td>
                  ) : null}
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-4 py-3.5 border-b border-[var(--border-muted)]">
                      <div
                        className="h-4 rounded bg-[var(--surface-3)] animate-pulse"
                        style={{ width: `${60 + (colIdx % 3) * 20}%` }}
                      />
                    </td>
                  ))}
                  {rowActions ? (
                    <td className="px-4 py-3.5 border-b border-[var(--border-muted)] text-right">
                      <div className="ml-auto h-7 w-14 rounded-lg bg-[var(--surface-3)] animate-pulse" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              visibleRows.map((row, index) => {
                const id = row[rowKey];
                const clickable = typeof onRowClick === 'function';
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={cn(
                      'group transition-colors duration-100 border-b border-[var(--border-muted)]',
                      isSelected ? 'bg-[var(--selected-bg)]' : 'hover:bg-[var(--hover-bg)]',
                      clickable && 'cursor-pointer',
                      rowClassName ? rowClassName(row) : ''
                    )}
                    onClick={clickable ? () => onRowClick(row, startIndex + index) : undefined}
                    onKeyDown={
                      clickable
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onRowClick(row, startIndex + index);
                            }
                          }
                        : undefined
                    }
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                  >
                    {selectable ? (
                      <td className="sticky left-0 border-b border-[var(--border-muted)] bg-[var(--surface)] group-hover:bg-[var(--hover-bg)] px-4 py-3 align-middle text-xs text-[var(--text-muted)]">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select row ${startIndex + index + 1}`}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => {
                      const rawContent = column.render
                        ? column.render(row, lookups, startIndex + index)
                        : row[column.key];
                      const content =
                        column.render && column.type === 'badge'
                          ? formatBadgeValue(rawContent)
                          : column.render
                          ? rawContent
                          : formatTableValue(rawContent, column.type);
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            'border-b border-[var(--border-muted)] px-4 py-3 align-middle text-xs font-normal text-[var(--text-main)]',
                            column.align === 'right' && 'text-right',
                            column.mono && 'font-mono text-xs text-[var(--text-muted)]',
                            column.ellipsis && 'max-w-[260px] truncate'
                          )}
                        >
                          {content}
                        </td>
                      );
                    })}
                    {rowActions ? (
                      <td
                        className="border-b border-[var(--border-muted)] px-4 py-3 text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {rowActions(row)}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--text-muted)] bg-[var(--surface)]">
        <span>
          Showing {totalRows ? startIndex + 1 : 0} to {Math.min(startIndex + currentPageSize, totalRows)} of{' '}
          {totalRows} records
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="px-2 font-semibold text-[var(--text-main)]">
            {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={currentPage >= totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
