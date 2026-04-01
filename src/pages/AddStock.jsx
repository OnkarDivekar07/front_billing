import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProductById, getReorderSuggestions, addStock } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useQrScanner } from "../hooks/useQrScanner";
import { useToast } from "../components/Toast";
import "../styles.css";

export default function AddStock() {
  const { productId } = useParams();
  const navigate      = useNavigate();
  const toast         = useToast();

  const [product,        setProduct]        = useState(null);
  const [suggestedOrder, setSuggestedOrder] = useState(null);
  const [scanning,       setScanning]       = useState(false);
  const [qty,            setQty]            = useState("");
  const [price,          setPrice]          = useState("");
  const [lowerThreshold, setLowerThreshold] = useState("");
  const [upperThreshold, setUpperThreshold] = useState("");
  const [loading,        setLoading]        = useState(false);

  // Load product when productId is available (from URL param or QR scan)
  const loadProduct = async (id) => {
    try {
      const [prodRes, reorderRes] = await Promise.allSettled([
        getProductById(id),
        getReorderSuggestions(),
      ]);

      if (prodRes.status === "fulfilled") {
        // Envelope: res.data.data = product
        const p = prodRes.value.data?.data ?? prodRes.value.data;
        setProduct(p);

        if (reorderRes.status === "fulfilled") {
          // Envelope: res.data.data = array of suggestions
          const suggestions = reorderRes.value.data?.data ?? [];
          const found = suggestions.find((s) => s.id === p.id);
          if (found) setSuggestedOrder(found.suggested_order_quantity);
        }
      } else {
        toast.error("प्रॉडक्ट सापडला नाही ❌");
      }
    } catch {
      toast.error("प्रॉडक्ट लोड होऊ शकला नाही");
    }
  };

  useEffect(() => {
    if (productId) loadProduct(productId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // QR scanner — only active when scanning=true and no product loaded yet
  useQrScanner(
    "stock-reader",
    scanning && !product,
    async (decoded) => {
      setScanning(false);
      await loadProduct(decoded);
    },
    (msg) => {
      setScanning(false);
      toast.error(`कॅमेरा सुरू झाला नाही: ${msg}`);
    }
  );

  const resetForm = () => {
    setProduct(null);
    setSuggestedOrder(null);
    setQty("");
    setPrice("");
    setLowerThreshold("");
    setUpperThreshold("");
  };

  const submitStock = async () => {
    const parsedQty = Number(qty);
    if (!qty || parsedQty <= 0) { toast.warn("प्रमाण भरा"); return; }

    const payload = {
      productId:   product.id,
      addQuantity: parsedQty,
    };
    if (price          !== "") payload.price           = Number(price);
    if (lowerThreshold !== "") payload.lower_threshold = Number(lowerThreshold);
    if (upperThreshold !== "") payload.upper_threshold = Number(upperThreshold);

    setLoading(true);
    try {
      await addStock(payload);
      toast.success("स्टॉक यशस्वीरीत्या अपडेट झाला ✅");
      resetForm();
      navigate("/search-stock");
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page center">
      <div className="card" style={{ maxWidth: 400 }}>
        <h2 style={{ margin: "0 0 16px", textAlign: "center" }}>📦 स्टॉक जोडा</h2>

        {/* No product yet — show scan / manual search options */}
        {!product && (
          <>
            {!scanning ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="primary-btn full" onClick={() => setScanning(true)}>
                  📷 QR स्कॅन करा
                </button>
                <button
                  className="primary-btn full"
                  style={{ background: "#457b9d" }}
                  onClick={() => navigate("/search-stock")}
                >
                  🔍 नाव शोधा
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div id="stock-reader" className="scanner-box" />
                <button
                  style={{ background: "none", border: "none", color: "#e63946", cursor: "pointer", fontSize: 14 }}
                  onClick={() => setScanning(false)}
                >
                  रद्द करा
                </button>
              </div>
            )}
          </>
        )}

        {/* Product loaded — show stock form */}
        {product && (
          <>
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f0fdf9", borderRadius: 10 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{product.marathiName || product.name}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>
                सध्याचा स्टॉक: <strong>{product.quantity}</strong>
              </p>
              {suggestedOrder !== null && suggestedOrder > 0 && (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                  सुचवलेली मात्रा: {suggestedOrder}
                </p>
              )}
            </div>

            {[
              { label: "प्रमाण *",                  val: qty,            set: setQty,            ph: "किती जोडायचे?" },
              { label: "नवीन किंमत (ऐच्छिक)",       val: price,          set: setPrice,          ph: "₹ किंमत"       },
              { label: "किमान स्टॉक (Min Threshold)", val: lowerThreshold, set: setLowerThreshold, ph: "उदा. 5"        },
              { label: "कमाल स्टॉक (Max Threshold)", val: upperThreshold, set: setUpperThreshold, ph: "उदा. 50"       },
            ].map(({ label, val, set, ph }) => (
              <div className="field" key={label}>
                <label>{label}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder={ph}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                className="primary-btn"
                style={{ flex: 1, background: "#6b7280", fontSize: 14, padding: "11px" }}
                onClick={resetForm}
              >
                मागे
              </button>
              <button
                className="primary-btn"
                style={{ flex: 2, fontSize: 15, padding: "11px" }}
                onClick={submitStock}
                disabled={loading}
              >
                {loading ? "अपडेट होत आहे..." : "स्टॉक अपडेट करा"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
