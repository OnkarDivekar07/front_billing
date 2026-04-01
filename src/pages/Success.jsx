import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";

export default function Success() {
  const navigate = useNavigate();

  // Redirect to home after billing success (was incorrectly going to /search)
  useEffect(() => {
    const t = setTimeout(() => navigate("/", { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="page center" style={{ flexDirection: "column", gap: 12 }}>
      <div className="check">✔</div>
      <h2 style={{ margin: 0, color: "#111827" }}>बिल यशस्वी!</h2>
      <p style={{ color: "#6b7280", fontSize: 14 }}>परत जात आहे...</p>
    </div>
  );
}
