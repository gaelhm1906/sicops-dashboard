import React, { memo } from "react";

const VARIANTS = {
  primary: "text-white border-transparent focus:ring-[#691C32]",
  secondary: "bg-white text-[#2C2C2C] border-[rgba(201,166,107,0.36)] hover:text-[#691C32] focus:ring-[#691C32]",
  danger: "bg-[#691C32] text-white border-transparent focus:ring-[#691C32]",
  success: "bg-[#006341] text-white border-transparent focus:ring-[#006341]",
  ghost: "bg-transparent text-[#666666] border-transparent hover:text-[#691C32] focus:ring-[#691C32]",
};

const SIZES = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

const VARIANT_STYLES = {
  primary: {
    background: "linear-gradient(135deg, #691C32 0%, #7A2440 100%)",
    boxShadow: "0 10px 24px rgba(105,28,50,0.20)",
  },
  secondary: {
    background: "linear-gradient(180deg, #FFFFFF 0%, #F7F3EE 100%)",
    boxShadow: "0 8px 20px rgba(82,58,32,0.08)",
  },
  danger: {
    background: "linear-gradient(135deg, #691C32 0%, #550A1F 100%)",
    boxShadow: "0 10px 24px rgba(105,28,50,0.20)",
  },
  success: {
    background: "linear-gradient(135deg, #006341 0%, #0A7C52 100%)",
    boxShadow: "0 10px 24px rgba(0,99,65,0.18)",
  },
  ghost: {
    background: "transparent",
    boxShadow: "none",
  },
};

function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  type = "button",
  className = "",
  onClick,
  style,
  ...rest
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none hover:translate-y-[-2px] hover:shadow-lg active:translate-y-0";
  const variantName = VARIANTS[variant] ? variant : "primary";
  const variantClass = VARIANTS[variantName];
  const sizeClass = SIZES[size] || SIZES.md;
  const variantStyle = VARIANT_STYLES[variantName];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variantClass} ${sizeClass} ${className}`}
      aria-busy={loading}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export default memo(Button);
