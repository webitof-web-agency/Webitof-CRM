import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
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
  const allVisibleSelected = selectable && visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row[rowKey]));

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        {toolbarLeft ? toolbarLeft : (
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span>{totalRows} records</span>
            {selectedIds.length ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-[var(--text)]">{selectedIds.length} selected</span> : null}
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
              ]}
            />
          </div>
          {onCreate ? (
            <Button type="button" onClick={onCreate}>
              {createLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-slate-50">
            <tr>
              {selectable ? (
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] w-12">
                  #
                </th>
              ) : null}
              {columns.map((column) => {
                const sorted = sortKey === column.key;
                const icon = sorted ? (sortDirection === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />) : <ChevronsUpDown size={14} />;
                return (
                  <th
                    key={column.key}
                    className={cn(
                      'border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 transition hover:text-[var(--text)]"
                      onClick={() => onSortChange?.(column.key, getNextSortDirection(sortKey, sortDirection, column.key))}
                    >
                      <span>{column.label}</span>
                      {column.sortable === false ? null : icon}
                    </button>
                  </th>
                );
              })}
              {rowActions ? <th className="border-b border-slate-200 px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => {
              const id = row[rowKey];
              return (
                <tr key={id} className={cn('transition hover:bg-slate-50', rowClassName ? rowClassName(row) : '')}>
                  {selectable ? (
                    <td className="sticky left-0 border-b border-slate-100 bg-white px-4 py-4 align-middle text-sm text-[var(--text-muted)]">
                      {startIndex + index + 1}
                    </td>
                  ) : null}
                  {columns.map((column) => {
                    const content = column.render ? column.render(row, lookups) : formatTableValue(row[column.key], column.type);
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'border-b border-slate-100 px-4 py-4 align-middle text-sm text-[var(--text)]',
                          column.align === 'right' && 'text-right',
                          column.mono && 'font-mono text-xs',
                          column.ellipsis && 'max-w-[260px] truncate'
                        )}
                      >
                        {content}
                      </td>
                    );
                  })}
                  {rowActions ? <td className="border-b border-slate-100 px-4 py-4 text-right">{rowActions(row)}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm text-[var(--text-muted)]">
        <span>
          Showing {totalRows === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + currentPageSize, totalRows)} of {totalRows}
        </span>
        
        {totalPages > 0 && (
          <div className="flex items-center gap-1">
            <button 
              type="button" 
              disabled={currentPage <= 1} 
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
              className="px-3 py-1.5 text-sm font-medium transition border border-transparent hover:border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let start = Math.max(1, currentPage - 2);
                let end = Math.min(totalPages, start + 4);
                if (end - start < 4) {
                  start = Math.max(1, end - 4);
                }
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center text-sm font-medium transition",
                      p === currentPage
                        ? "bg-[var(--primary,var(--accent,#0ea5e9))] text-white shadow-sm"
                        : "border border-slate-200 bg-white text-[var(--text-main)] hover:bg-slate-50"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button 
              type="button" 
              disabled={currentPage >= totalPages} 
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}
              className="px-3 py-1.5 text-sm font-medium transition border border-transparent hover:border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTableValue(value, type) {
  if (value == null || value === '') return '-';
  if (type === 'money') {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
      : value;
  }
  if (type === 'date') return String(value).slice(0, 10);
  if (type === 'badge') {
    if (typeof value === 'boolean') {
      const text = value ? 'Yes' : 'No';
      return (
        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-700')}>
          {text}
        </span>
      );
    }
    const text = String(value);
    const tone = text === 'Active' || text === 'Paid' || text === 'Completed' || text === 'Renewed' ? 'success' : text === 'Pending' || text === 'Due' ? 'warning' : 'neutral';
    return (
      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700', tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700', tone === 'neutral' && 'border-slate-200 bg-slate-100 text-slate-700')}>
        {text}
      </span>
    );
  }
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
