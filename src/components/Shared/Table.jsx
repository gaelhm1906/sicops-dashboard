import React, { memo } from "react";

function Table({ columns, data, onRowClick, emptyMessage = "Sin datos", className = "", getRowKey }) {
  return (
    <div
      className={`overflow-x-auto rounded-xl ${className}`}
      style={{ border: "1px solid #D4C4B0" }}
    >
      <table className="w-full text-sm text-left">
        <thead style={{ backgroundColor: "#FAFAF8", borderBottom: "1px solid #D4C4B0" }}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.onSort}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap
                  ${col.onSort ? "cursor-pointer select-none hover:text-[#691C32]" : ""}
                  ${col.className || ""}`}
                style={{ color: "#666666" }}
                aria-sort={col.sortDir}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.onSort && (
                    <span className="text-xs" style={{ color: "#D4C4B0" }}>
                      {col.sortDir === "asc" ? "▲" : col.sortDir === "desc" ? "▼" : "⇅"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm"
                style={{ color: "#666666" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={getRowKey ? getRowKey(row, i) : (row.id ?? i)}
                onClick={() => onRowClick?.(row)}
                className={`transition-all duration-200 ${onRowClick ? "cursor-pointer" : ""}`}
                style={{ borderBottom: "1px solid rgba(212,196,176,0.4)" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F5F3F0"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-4 ${col.cellClass || ""}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(Table);
