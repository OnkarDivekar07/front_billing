import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * useQrScanner — manages the full html5-qrcode lifecycle.
 *
 * @param {string}   elementId  DOM id to mount scanner into
 * @param {boolean}  active     scanner starts when true, stops when false
 * @param {Function} onResult   called with the decoded string on success
 * @param {Function} onError    optional — called with message on camera/start failure
 */
export function useQrScanner(elementId, active, onResult, onError) {
  const scannerRef   = useRef(null);
  const startedRef   = useRef(false);
  const resolvedRef  = useRef(false); // prevent multiple onResult calls

  useEffect(() => {
    if (!active) return;
    if (startedRef.current) return;
    startedRef.current = true;
    resolvedRef.current = false;

    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 260 },
        async (decoded) => {
          if (resolvedRef.current) return;
          resolvedRef.current = true;
          try {
            await scanner.stop();
          } catch { /* ignore stop errors */ }
          onResult(decoded.trim());
        }
      )
      .catch((err) => {
        console.error("QR scanner start failed:", err);
        onError?.(err?.message ?? "Camera failed to start");
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, elementId]);
}
