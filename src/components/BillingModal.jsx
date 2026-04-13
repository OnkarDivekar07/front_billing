import { useState, useEffect} from "react";
import { submitBilling } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "./Toast";
import "./BillingModal.css";

const UNIT_MULTIPLIER = { pcs: 1, jodi: 2, dozen: 12 };
const UNIT_LABEL      = { pcs: "नग", jodi: "जोडी", dozen: "डझन" };

const LS_DATE_KEY = "billing_selected_date";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
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

/**
 * BillingModal — bottom-sheet billing form rendered as an overlay.
 * Opened when the user taps a product card on the Home page.
 *
 * Props:
 *   product   — full product object
 *   onClose   — called to dismiss (cancel or backdrop click)
 *   onSuccess — called after successful bill submission
 */
export default function BillingModal({ product, onClose, onSuccess }) {
  const toast = useToast();

  const [qty,        setQty]        = useState("");
  const [unit,       setUnit]       = useState("pcs");
  const [price,      setPrice]      = useState("");
  const [payment,    setPayment]    = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [billDate,   setBillDate]   = useState(getInitialDate);

  // Reset form and default unit whenever a new product is shown
  useEffect(() => {
    setQty("");
    setPrice("");
    setPayment("cash");
    setUnit(
      product?.defaultUnit && UNIT_MULTIPLIER[product.defaultUnit]
        ? product.defaultUnit
        : "pcs"
    );
  }, [product]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!product) return null;

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
          productId: product.id,
          item_name: product.name,
          quantity:  pcsQty,
          price:     perPcPrice,
          total,
        },
        {
          total_amount:   total,
          payment_method: payment,
          billing_date:   billDate,
        },
      ];

      await submitBilling(payload);
      toast.success("बिल यशस्वी! ✅");
      onSuccess?.();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div className="modal-sheet">

        {/* Header */}
        <div className="modal-header">
          <div className="modal-drag-handle" />
          <button className="modal-close" onClick={onClose} aria-label="बंद करा">✕</button>
        </div>

        {/* Product info */}
        <div className="modal-product-info">
          {product.imageUrl && (
            <img
              src={product.imageUrl}
              alt={displayName}
              className="modal-product-img"
            />
          )}
          <h2 className="modal-product-name">{displayName}</h2>
          {product.marathiName && product.name !== product.marathiName && (
            <p className="modal-product-sub">{product.name}</p>
          )}
        </div>

        {/* Date Selector */}
        <div className="field">
          <label>📅 बिलाची तारीख</label>
          <input
            type="date"
            value={billDate}
            max={getTodayStr()}
            onChange={(e) => {
              setBillDate(e.target.value);
              try { localStorage.setItem(LS_DATE_KEY, e.target.value); } catch {}
            }}
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
          <p className="modal-calc-hint">
            {qty} {UNIT_LABEL[unit]} = {pcsQty} नग × ₹{perPcPrice} प्रति नग
          </p>
        )}

        {/* Total */}
        <div className="modal-total">
          एकूण: ₹{total}
        </div>

        {/* Payment method */}
        <div className="modal-payment">
          {[
            { val: "cash",   label: "💵 रोख"    },
            { val: "online", label: "📲 ऑनलाईन" },
          ].map(({ val, label }) => (
            <label
              key={val}
              className={`payment-option ${payment === val ? "active" : ""}`}
            >
              <input
                type="radio"
                checked={payment === val}
                onChange={() => setPayment(val)}
                style={{ display: "none" }}
              />
              {label}
            </label>
          ))}
        </div>

        {/* Submit */}
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
