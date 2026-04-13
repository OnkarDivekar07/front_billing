import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProductById, submitBilling } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "../styles.css";

const UNIT_MULTIPLIER = { pcs: 1, jodi: 2, dozen: 12 };
const UNIT_LABEL      = { pcs: "नग", jodi: "जोडी", dozen: "डझन" };

const LS_DATE_KEY = "billing_selected_date";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getInitialDate() {
  try {
    const stored = localStorage.getItem(LS_DATE_KEY);
    if (stored) return stored;
    const today = getTodayStr();
    localStorage.setItem(LS_DATE_KEY, today);
    return today;
  } catch {
    return getTodayStr();
  }
}

export default function Billing() {
  const { productId } = useParams();
  const navigate      = useNavigate();
  const toast         = useToast();

  const [product,    setProduct]    = useState(null);
  const [qty,        setQty]        = useState("");
  const [unit,       setUnit]       = useState("pcs");
  const [price,      setPrice]      = useState("");
  const [payment,    setPayment]    = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [loadError,  setLoadError]  = useState("");
  const [billDate,   setBillDate]   = useState(getInitialDate);

  // Persist date to localStorage whenever user manually changes it
  const handleDateChange = (e) => {
    const val = e.target.value;
    setBillDate(val);
    try { localStorage.setItem(LS_DATE_KEY, val); } catch {}
  };

  useEffect(() => {
    setLoadError("");
    getProductById(productId)
      .then((res) => {
        const p = res.data?.data ?? res.data;
        setProduct(p);
        if (p?.defaultUnit && UNIT_MULTIPLIER[p.defaultUnit]) {
          setUnit(p.defaultUnit);
        }
      })
      .catch(() => setLoadError("प्रॉडक्ट लोड होऊ शकला नाही ❌"));
  }, [productId]);

  if (loadError) return (
    <div className="page center">
      <div className="card" style={{ textAlign: "center", gap: 16 }}>
        <p style={{ color: "#e63946" }}>{loadError}</p>
        <button className="primary-btn" onClick={() => navigate(-1)}>मागे जा</button>
      </div>
    </div>
  );

  if (!product) return <p className="loading">लोड होत आहे...</p>;

  const displayName = product.marathiName || product.name;
  const multiplier  = UNIT_MULTIPLIER[unit] ?? 1;
  const pcsQty      = Number(qty || 0) * multiplier;
  const perPcPrice  = multiplier > 0
    ? Number((Number(price || 0) / multiplier).toFixed(2))
    : 0;
  const total   = Number((pcsQty * perPcPrice).toFixed(2));
  const isValid = Number(qty) > 0 && Number(price) > 0 && pcsQty > 0 && perPcPrice > 0;

  const submitBill = async () => {
    if (!isValid) { toast.warn("कृपया योग्य प्रमाण आणि दर भरा"); return; }

    setSubmitting(true);
    try {
      const payload = [
        {
          productId:  product.id,
          item_name:  product.name,
          quantity:   pcsQty,
          price:      perPcPrice,
          total,
        },
        {
          total_amount:   total,
          payment_method: payment,
          billing_date:   billDate,
        },
      ];

      await submitBilling(payload);
      navigate("/success");
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page center">
      <div className="card billing-card">
        <h2 className="product-name">{displayName}</h2>

        {/* Date Selector */}
        <div className="field">
          <label>📅 बिलाची तारीख</label>
          <input
            type="date"
            value={billDate}
            max={getTodayStr()}
            onChange={handleDateChange}
            style={{ width: "100%" }}
          />
        </div>

        {/* Quantity + Unit */}
        <div className="field">
          <label>प्रमाण</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="संख्या"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{ flex: 2 }}
              autoFocus
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ flex: 1 }}
            >
              {Object.entries(UNIT_LABEL).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Price */}
        <div className="field">
          <label>दर (प्रति {UNIT_LABEL[unit]})</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="दर टाका"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        {/* Calculation hint */}
        {isValid && (
          <p style={{ fontSize: 13, color: "#666", margin: "8px 0 0" }}>
            {qty} {UNIT_LABEL[unit]} = {pcsQty} नग × ₹{perPcPrice} प्रति नग
          </p>
        )}

        <h3 style={{ textAlign: "center", margin: "14px 0", fontSize: 20 }}>
          एकूण: ₹{total}
        </h3>

        {/* Payment method */}
        <div className="payment-row">
          {[
            { val: "cash",   label: "💵 रोख" },
            { val: "online", label: "📲 ऑनलाईन" },
          ].map(({ val, label }) => (
            <label
              key={val}
              className={`payment-option ${payment === val ? "active" : ""}`}
            >
              <input
                type="radio"
                style={{ display: "none" }}
                checked={payment === val}
                onChange={() => setPayment(val)}
              />
              {label}
            </label>
          ))}
        </div>

        <button
          className="primary-btn full"
          onClick={submitBill}
          disabled={!isValid || submitting}
          style={{ marginTop: 8 }}
        >
          {submitting ? "सबमिट होत आहे..." : "बिल सबमिट करा"}
        </button>
      </div>
    </div>
  );
}
