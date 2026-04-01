import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQrScanner } from "../hooks/useQrScanner";
import { getProductById } from "../api/endpoints";
import "../styles.css";

export default function ScanQR() {
  const navigate = useNavigate();
  const [error, setError]       = useState("");
  const [checking, setChecking] = useState(false);

  // Validate the scanned ID is a real product before navigating
  // — prevents crashes if a random QR code is scanned
  const handleResult = async (decoded) => {
    setChecking(true);
    setError("");
    try {
      await getProductById(decoded);
      navigate(`/billing/${decoded}`);
    } catch {
      setError("हा QR कोड ओळखला नाही ❌ — पुन्हा प्रयत्न करा");
      setChecking(false);
    }
  };

  useQrScanner("qr-reader", true, handleResult, (msg) => {
    setError(`कॅमेरा सुरू झाला नाही: ${msg}`);
  });

  return (
    <div className="page center" style={{ flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0 }}>QR स्कॅन करा</h2>

      {checking ? (
        <p className="loading">प्रॉडक्ट तपासत आहे...</p>
      ) : (
        <div id="qr-reader" className="scanner-box" />
      )}

      {error && (
        <div style={{
          background: "#fff5f5",
          border: "1px solid #fca5a5",
          borderRadius: 8,
          padding: "12px 16px",
          color: "#c53030",
          fontSize: 14,
          maxWidth: 300,
          textAlign: "center",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
