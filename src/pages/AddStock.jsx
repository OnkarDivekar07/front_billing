import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProductById,
  getReorderSuggestions,
  addStock,
  createProduct,
} from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useQrScanner } from "../hooks/useQrScanner";
import { useToast } from "../components/Toast";
import "../styles.css";

// Exact same empty state as Inventory.jsx
const NEW_EMPTY = {
  name:            "",
  quantity:        "",
  price:           "",
  lower_threshold: "",
  upper_threshold: "",
};

export default function AddStock() {
  const { productId } = useParams();
  const navigate      = useNavigate();
  const toast         = useToast();

  // ── Add Stock state ───────────────────────────────────────────────────────
  const [product,        setProduct]        = useState(null);
  const [suggestedOrder, setSuggestedOrder] = useState(null);
  const [scanning,       setScanning]       = useState(false);
  const [qty,            setQty]            = useState("");
  const [price,          setPrice]          = useState("");
  const [lowerThreshold, setLowerThreshold] = useState("");
  const [upperThreshold, setUpperThreshold] = useState("");
  const [loading,        setLoading]        = useState(false);

  // ── Add New Product state (mirrors Inventory.jsx exactly) ─────────────────
  const [showNewForm,  setShowNewForm]  = useState(false);
  const [newProduct,   setNewProduct]   = useState(NEW_EMPTY);
  const [newLoading,   setNewLoading]   = useState(false);

  // ─────────────────────────────────────────────────────────────────────────

  const loadProduct = async (id) => {
    try {
      const [prodRes, reorderRes] = await Promise.allSettled([
        getProductById(id),
        getReorderSuggestions(),
      ]);

      if (prodRes.status === "fulfilled") {
        const p = prodRes.value.data?.data ?? prodRes.value.data;
        setProduct(p);

        if (reorderRes.status === "fulfilled") {
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

  const resetStockForm = () => {
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

    const payload = { productId: product.id, addQuantity: parsedQty };
    if (price          !== "") payload.price           = Number(price);
    if (lowerThreshold !== "") payload.lower_threshold = Number(lowerThreshold);
    if (upperThreshold !== "") payload.upper_threshold = Number(upperThreshold);

    setLoading(true);
    try {
      await addStock(payload);
      toast.success("स्टॉक यशस्वीरीत्या अपडेट झाला ✅");
      resetStockForm();
      navigate("/search-stock");
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // Mirrors Inventory.jsx handleAdd — same payload shape, same validation
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) { toast.warn("Product name required"); return; }
    if (!newProduct.price || Number(newProduct.price) <= 0) {
      toast.warn("Price is required and must be greater than 0");
      return;
    }
    try {
      setNewLoading(true);
      await createProduct({
        name:            newProduct.name.trim(),
        quantity:        Number(newProduct.quantity)        || 0,
        price:           Number(newProduct.price),
        lower_threshold: Number(newProduct.lower_threshold) || 0,
        upper_threshold: Number(newProduct.upper_threshold) || 0,
      });
      toast.success("Product added.");
      setShowNewForm(false);
      setNewProduct(NEW_EMPTY);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setNewLoading(false);
    }
  };

  return (
    <div className="page center">
      <div className="card" style={{ maxWidth: 400 }}>
        <h2 style={{ margin: "0 0 16px", textAlign: "center" }}>📦 स्टॉक जोडा</h2>

        {/* ── No product selected: scan / search ── */}
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

        {/* ── Product selected: add stock form ── */}
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
              { label: "प्रमाण *",                   val: qty,            set: setQty,            ph: "किती जोडायचे?" },
              { label: "नवीन किंमत (ऐच्छिक)",        val: price,          set: setPrice,          ph: "₹ किंमत"       },
              { label: "किमान स्टॉक (Min Threshold)", val: lowerThreshold, set: setLowerThreshold, ph: "उदा. 5"        },
              { label: "कमाल स्टॉक (Max Threshold)",  val: upperThreshold, set: setUpperThreshold, ph: "उदा. 50"       },
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
                onClick={resetStockForm}
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

        {/* ── Divider ── */}
        <div style={{
          margin: "22px 0 16px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>
            नवीन प्रॉडक्ट
          </span>
          <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
        </div>

        {/* ── Add New Product — always visible, mirrors Inventory.jsx ── */}
        <button
          className="primary-btn full"
          style={{ background: "#7c3aed", marginBottom: showNewForm ? 14 : 0 }}
          onClick={() => setShowNewForm((v) => !v)}
        >
          {showNewForm ? "✕ बंद करा" : "+ नवीन प्रॉडक्ट जोडा"}
        </button>

        {showNewForm && (
          <div>
            {[
              { key: "name",            placeholder: "Product name",    type: "text"   },
              { key: "quantity",        placeholder: "Quantity",        type: "number" },
              { key: "price",           placeholder: "Price (₹) *",     type: "number" },
              { key: "lower_threshold", placeholder: "Lower threshold", type: "number" },
              { key: "upper_threshold", placeholder: "Upper threshold", type: "number" },
            ].map(({ key, placeholder, type }) => (
              <div className="field" key={key}>
                <input
                  type={type}
                  inputMode={type === "number" ? "numeric" : "text"}
                  placeholder={placeholder}
                  value={newProduct[key]}
                  onChange={(e) =>
                    setNewProduct((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <button
              className="primary-btn full"
              style={{ background: "#16a34a", marginTop: 4 }}
              onClick={handleAddProduct}
              disabled={newLoading}
            >
              {newLoading ? "जोडत आहे..." : "Save Product"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
