import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

/**
 * React Router stores its position in the history stack as `idx` on the history
 * state, which is the only way to tell whether back/forward have anywhere to go.
 */
function historyIndex(): number {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === "number" ? state.idx : 0;
}

export function useNavHistory() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const furthest = useRef(historyIndex());
  const [index, setIndex] = useState(historyIndex);

  useEffect(() => {
    const idx = historyIndex();
    // A push truncates any forward entries, so the stack ends at the new index.
    furthest.current = navigationType === "PUSH" ? idx : Math.max(furthest.current, idx);
    setIndex(idx);
  }, [location, navigationType]);

  const goBack = useCallback(() => navigate(-1), [navigate]);
  const goForward = useCallback(() => navigate(1), [navigate]);

  return {
    canGoBack: index > 0,
    canGoForward: index < furthest.current,
    goBack,
    goForward,
  };
}
