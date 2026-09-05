import React from 'react';
import { ChevronsUpDown } from 'lucide-react';

export const Table = ({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
}) => {
  return (
    <div className="w-full overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] transition-colors">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-400 dark:text-slate-500 select-none">
            {columns.map((col, idx) => (
              <th key={idx} className={`px-5 py-4 ${col.className || ''}`}>
                <div className="flex items-center space-x-1.5">
                  <span>{col.header}</span>
                  {col.sortable !== false && col.header && (
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 opacity-80" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5345E6] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5345E6] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#5345E6] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={row.id || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors duration-100 hover:bg-[#F9FAFD] dark:hover:bg-slate-800/60 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`px-5 py-4 text-slate-700 dark:text-slate-200 ${col.className || ''}`}>
                    {col.render ? col.render(row, rowIdx) : row[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
