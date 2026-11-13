import { useEffect, useRef } from "react";

/** Opens and closes an s-modal from React state; the modal's own close (Esc, X) calls `onClose`. */
export function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElementTagNameMap["s-modal"]>(null);

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    if (open) modal.showOverlay();
    else modal.hideOverlay();
  }, [open]);

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return undefined;
    modal.addEventListener("hide", onClose);
    return () => modal.removeEventListener("hide", onClose);
  }, [onClose]);

  return ref;
}
