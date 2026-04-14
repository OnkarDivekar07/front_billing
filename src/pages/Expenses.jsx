import { useState, useEffect, useCallback } from "react";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./expenses.css";

/* ── constants ──────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "purchase",      label: "📦 खरेदी"  },
  { value: "transport",     label: "🚚 वाहतूक"  },
  { value: "miscellaneous", label: "📋 इतर"     },
];

const PAYMENT_METHODS = [
  { value: "cash",   label: "💵 रोख"    },
  { value: "online", label: "📲 ऑनलाईन" },
];

const CAT_MAP     = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const CAT_COLOR   = { purchase: "#e0f2fe", transport: "#fef9c3", miscellaneous: "#f3e8ff" };
const CAT_TEXT    = { purchase: "#0369a1", transport: "#a16207",  miscellaneous: "#7e22ce" };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Build YYYY-MM from year+month numbers
function toYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// From YYYY-MM → { from: YYYY-MM-01, to: YYYY-MM-last }
function monthRange(ym) {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1).toISOString().slice(0, 10);
  const to   = new Date(y, m, 0).toISOString().slice(0, 10);
  return { from, to };
}

function currentYM() {
  const now = new Date();
  return toYearMonth(now.getFullYear(), now.getMonth() + 1);
}

// Build last 12 months for the month picker
function buildMonthOptions() {
  const opts = [];
  const now  = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = toYearMonth(d.getFullYear(), d.getMonth() + 1);
    const label = d.toLocaleDateString("mr-IN", { month: "long", year: "numeric" });
    opts.push({ value: ym, label });
  }
  return opts;
}

const MONTH_OPTIONS = buildMonthOptions();

const EMPTY_FORM = {
  description:    "",
  total_bill:     "",
  expense_type:   "purchase",
  payment_method: "cash",
  expense_date:   todayStr(),
  supplier_name:  "",
  notes:          "",
};

/* ── component ─────────────────────────────────────────────────────────────── */
export default function Expenses() {
  const toast = useToast();

  const [selectedMonth, setSelectedMonth] = useState(currentYM());
  const [expenses,      setExpenses]      = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState(null);

  const [form,          setForm]          = useState(EMPTY_FORM);
  const [editId,        setEditId]        = useState(null);
  const [showForm,      setShowForm]      = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [deletingId,    setDeletingId]    = useState(null);

  /* ── fetch ────────────────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { from, to } = monthRange(selectedMonth);
      const [expRes, sumRes] = await Promise.all([
        getExpenses({ from, to }),
        getExpenseSummary(),
      ]);
      setExpenses(expRes.data?.data ?? []);
      setSummary(sumRes.data?.data ?? null);
    } catch (err) {
      setFetchError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── form helpers ─────────────────────────────────────────────────────────── */
  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, expense_date: todayStr() });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setForm({
      description:    exp.description,
      total_bill:     String(exp.total_amount),
      expense_type:   exp.expense_type,
      payment_method: exp.payment_method,
      expense_date:   exp.expense_date
        ? new Date(exp.expense_date).toISOString().slice(0, 10)
        : todayStr(),
      supplier_name:  exp.Supplier?.name || "",
      notes:          exp.notes || "",
    });
    setEditId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); };

  /* ── submit ──────────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!form.description.trim()) { toast.warn("वर्णन भरा"); return; }
    if (!form.total_bill || Number(form.total_bill) <= 0) {
      toast.warn("योग्य रक्कम भरा"); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        description:    form.description.trim(),
        total_bill:     Number(form.total_bill),
        expense_type:   form.expense_type,
        payment_method: form.payment_method,
        expense_date:   form.expense_date || todayStr(),
        notes:          form.notes.trim() || undefined,
      };
      if (editId) {
        await updateExpense(editId, payload);
        toast.success("खर्च अपडेट झाला ✅");
      } else {
        await createExpense(payload);
        toast.success("खर्च जोडला ✅");
      }
      closeForm();
      await fetchAll();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── delete ──────────────────────────────────────────────────────────────── */
  const handleDelete = async (id, description) => {
    if (!window.confirm(`"${description}" काढायचा आहे का?`)) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      toast.success("खर्च काढला ✅");
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeletingId(null);
    }
  };

  /* ── derived totals ──────────────────────────────────────────────────────── */
  const monthTotal     = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const purchaseTotal  = expenses.filter((e) => e.expense_type === "purchase").reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const transportTotal = expenses.filter((e) => e.expense_type === "transport").reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const miscTotal      = expenses.filter((e) => e.expense_type === "miscellaneous").reduce((s, e) => s + Number(e.total_amount || 0), 0);

  const selectedLabel  = MONTH_OPTIONS.find((o) => o.value === selectedMonth)?.label || selectedMonth;

  /* ── render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="exp-page">

      {/* ── Top summary block ─────────────────────────────────────────────── */}
      <div className="exp-summary-block">
        <div className="exp-summary-header">
          <div>
            <h2 className="exp-page-title">💸 खर्च</h2>
            <p className="exp-page-sub">ऑपरेटिंग खर्चाचा मागोवा</p>
          </div>
          <select
            className="exp-month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {MONTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="exp-total-row">
          <span className="exp-total-label">{selectedLabel} — एकूण खर्च</span>
          <span className="exp-total-value">₹{fmt(monthTotal)}</span>
        </div>

        <div className="exp-breakdown-row">
          <div className="exp-breakdown-chip purchase">
            <span className="exp-chip-label">📦 खरेदी</span>
            <span className="exp-chip-value">₹{fmt(purchaseTotal)}</span>
          </div>
          <div className="exp-breakdown-chip transport">
            <span className="exp-chip-label">🚚 वाहतूक</span>
            <span className="exp-chip-value">₹{fmt(transportTotal)}</span>
          </div>
          <div className="exp-breakdown-chip misc">
            <span className="exp-chip-label">📋 इतर</span>
            <span className="exp-chip-value">₹{fmt(miscTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── List header ──────────────────────────────────────────────────── */}
      <div className="exp-list-header">
        <span className="exp-list-count">
          {loading ? "लोड होत आहे..." : `${expenses.length} नोंदी`}
        </span>
        <button className="exp-add-btn" onClick={openAdd}>+ खर्च जोडा</button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {fetchError && <div className="exp-error">⚠️ {fetchError}</div>}

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {!loading && expenses.length === 0 && !fetchError && (
        <div className="exp-empty">या महिन्यात कोणताही खर्च नाही</div>
      )}

      {!loading && expenses.length > 0 && (
        <ul className="exp-list">
          {expenses.map((exp) => (
            <li key={exp.id} className="exp-row">
              <div className="exp-row-left">
                <div className="exp-row-top">
                  <span className="exp-row-title">{exp.description}</span>
                  <span className="exp-row-amount">₹{fmt(exp.total_amount)}</span>
                </div>
                <div className="exp-row-meta">
                  <span
                    className="exp-cat-badge"
                    style={{
                      background: CAT_COLOR[exp.expense_type] || "#f3f4f6",
                      color:      CAT_TEXT[exp.expense_type]  || "#374151",
                    }}
                  >
                    {CAT_MAP[exp.expense_type] || exp.expense_type}
                  </span>
                  <span className={`exp-pay-badge ${exp.payment_method}`}>
                    {exp.payment_method === "cash" ? "💵 रोख" : "📲 ऑनलाईन"}
                  </span>
                  <span className="exp-date">
                    {exp.expense_date
                      ? new Date(exp.expense_date).toLocaleDateString("en-IN")
                      : "—"}
                  </span>
                  {exp.Supplier && (
                    <span className="exp-supplier">🏪 {exp.Supplier.name}</span>
                  )}
                  {exp.notes && (
                    <span className="exp-note" title={exp.notes}>📝 {exp.notes}</span>
                  )}
                </div>
              </div>
              <div className="exp-row-actions">
                <button className="exp-edit-btn" onClick={() => openEdit(exp)}>✏️</button>
                <button
                  className="exp-del-btn"
                  onClick={() => handleDelete(exp.id, exp.description)}
                  disabled={deletingId === exp.id}
                >
                  {deletingId === exp.id ? "..." : "✕"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="exp-modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && closeForm()}
        >
          <div className="exp-modal">
            <div className="exp-modal-header">
              <h3>{editId ? "खर्च बदला" : "नवीन खर्च जोडा"}</h3>
              <button className="exp-modal-close" onClick={closeForm}>✕</button>
            </div>

            {/* expense_type */}
            <div className="field">
              <label>प्रकार</label>
              <div className="exp-type-row">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`exp-type-btn ${form.expense_type === c.value ? "active" : ""}`}
                    onClick={() => setField("expense_type", c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* description */}
            <div className="field">
              <label>वर्णन *</label>
              <input
                type="text"
                placeholder="उदा. माल खरेदी, गाडी भाडे, वीज बिल..."
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                autoFocus
                maxLength={200}
              />
            </div>

            {/* amount */}
            <div className="field">
              <label>रक्कम (₹) *</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0.00"
                value={form.total_bill}
                onChange={(e) => setField("total_bill", e.target.value)}
              />
            </div>

            {/* date */}
            <div className="field">
              <label>📅 तारीख</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setField("expense_date", e.target.value)}
              />
            </div>

            {/* supplier (optional text — no dropdown since supplier_id is optional) */}
            <div className="field">
              <label>पुरवठादार (ऐच्छिक)</label>
              <input
                type="text"
                placeholder="पुरवठादाराचे नाव"
                value={form.supplier_name}
                onChange={(e) => setField("supplier_name", e.target.value)}
                maxLength={100}
              />
            </div>

            {/* payment_method */}
            <div className="field">
              <label>पेमेंट पद्धत</label>
              <div className="exp-pay-row">
                {PAYMENT_METHODS.map((p) => (
                  <label
                    key={p.value}
                    className={`payment-option ${form.payment_method === p.value ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      style={{ display: "none" }}
                      checked={form.payment_method === p.value}
                      onChange={() => setField("payment_method", p.value)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            {/* notes */}
            <div className="field">
              <label>नोंद (ऐच्छिक)</label>
              <input
                type="text"
                placeholder="बिल नंबर, संदर्भ..."
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="exp-modal-footer">
              <button className="exp-cancel-btn" onClick={closeForm} disabled={submitting}>
                रद्द करा
              </button>
              <button className="primary-btn" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "सेव्ह होत आहे..." : editId ? "बदला" : "जोडा"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
