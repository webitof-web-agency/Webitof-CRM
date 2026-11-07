import { cn } from '../../lib/cn';

// Plain read-mostly table for lists that live inside a card or modal. For full page lists with
// search, sorting, selection and paging use DataTable instead.
//
// columns: [{ key, label, render?(row, index), align?: 'left' | 'right', nowrap?, className?, headerClassName? }]
export function SimpleTable({
  columns,
  rows = [],
  rowKey = 'id',
  onRowClick,
  rowClassName,
  emptyText = '',
  loading = false,
  rowActions,
  compact = false,
  roomy = false,
  stickyHeader = false,
  bordered = true,
  textSize = 'xs',
  headerClassName = '',
  className = ''
}) {
  const cell = compact ? 'px-2 py-1.5' : roomy ? 'px-4 py-3' : 'px-3 py-2';
  const columnCount = columns.length + (rowActions ? 1 : 0);
  const getKey = (row, index) => (typeof rowKey === 'function' ? rowKey(row, index) : row?.[rowKey] ?? index);

  return (
    <div className={cn('overflow-x-auto', bordered && 'rounded-xl border border-[var(--border)]', className)}>
      <table className={cn('w-full text-left', textSize === 'sm' ? 'text-sm' : 'text-xs')}>
        <thead
          className={cn(
            'bg-[var(--surface-2)] text-[var(--text-muted)]',
            stickyHeader && 'sticky top-0 z-10'
          )}
        >
          <tr>
            {columns.map((col, i) => (
              <th
                key={col.key ?? i}
                className={cn(
                  cell,
                  'whitespace-nowrap text-xs font-semibold',
                  col.align === 'right' && 'text-right',
                  headerClassName,
                  col.headerClassName
                )}
              >
                {col.label}
              </th>
            ))}
            {rowActions ? <th className={cn(cell, 'whitespace-nowrap text-xs font-semibold')}>Actions</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={`loading-${i}`}>
                  <td colSpan={columnCount} className={cell}>
                    <div className="h-5 animate-pulse rounded bg-[var(--surface-2)]" />
                  </td>
                </tr>
              ))
            : null}
          {!loading && rows.length === 0 && emptyText ? (
            <tr>
              <td colSpan={columnCount} className={cn(cell, 'py-6 text-center text-[var(--text-muted)]')}>
                {emptyText}
              </td>
            </tr>
          ) : null}
          {(loading ? [] : rows).map((row, index) => {
            const clickable = typeof onRowClick === 'function';
            return (
              <tr
                key={getKey(row, index)}
                className={cn(
                  'text-[var(--text-main)] transition-colors hover:bg-[var(--hover-bg)]',
                  clickable && 'cursor-pointer',
                  rowClassName ? rowClassName(row, index) : ''
                )}
                onClick={clickable ? () => onRowClick(row, index) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row, index);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key ?? i}
                    className={cn(cell, col.align === 'right' && 'text-right', col.nowrap && 'whitespace-nowrap', col.className)}
                  >
                    {col.render ? col.render(row, index) : (row?.[col.key] ?? '-')}
                  </td>
                ))}
                {rowActions ? (
                  <td className={cell} onClick={(event) => event.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">{rowActions(row, index)}</div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
