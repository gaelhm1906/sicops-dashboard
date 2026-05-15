import React from "react";
import RestrictedModule from "./RestrictedModule";

export default function ProtectedFeature({ allow, children, fallbackBadge }) {
  if (!allow) {
    return <RestrictedModule badge={fallbackBadge} />;
  }

  return children;
}
