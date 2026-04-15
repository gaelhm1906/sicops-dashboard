import React, { memo, forwardRef } from "react";

const Input = forwardRef(function Input(
  { label, error, hint, id, type = "text", className = "", required = false, ...rest },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`
          w-full px-3 py-2 text-sm rounded-lg border bg-white text-gray-900 placeholder-gray-400
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-[#691C32] focus:border-[#691C32]
          disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
          ${error
            ? "border-red-400 focus:ring-red-400 bg-red-50"
            : "border-[#D4C4B0] hover:border-[#691C32]/50"}
          ${className}
        `}
        {...rest}
      />

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
});

export default memo(Input);
