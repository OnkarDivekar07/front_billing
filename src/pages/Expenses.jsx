import { useState, useEffect, useCallback } from "react";
import {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  getSuppliers,
} from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./expenses.css";

/* ── Constants ──────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: "purchase",      label: "📦 खरेदी"  },
  { value: "transport",     label: "🚚 वाहतूक"  },
  { value: "miscellaneous", label: "📋 इतर"     },
];

const PAYMENT_METHODS = [
  { value: "cash",   label: "💵 रोख"    },
  { value: "online", label: "📲 ऑनलाईन" },
];

const CAT_COLOR = {
  purchase:      "#e0f2fe",
  transport:     "#fef9c3",
  miscellaneous: "#f3e8ff",
};
const CAT_TEXT = {
  purchase:      "#0369a1",
  transport:     "#a16207",
  miscellaneous: "#7e22ce",
};
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

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

/* ── Empty form state ───────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  expense_type:   "purchase",
  purchase_mode:  "direct",   // "direct" | "itemised"  — purchase only
  supplier_id:    "",
  description:    "",
  total_bill:     "",         // purchase direct mode
  quantity:       "",         // purchase itemised mode
  unit_cost:      "",         // purchase itemised / transport / misc
  payment_method: "cash",
  expense_date:   todayStr(),
  notes:          "",
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function Expenses() {
  const toast = useToast();

  /* ── State ──────────────────────────────────────────────────────────────── */
  const [selectedMonth, setSelectedMonth] = useState(currentYM());
  const [expenses,      setExpenses]      = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [suppliers,     setSuppliers]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState(null);

  // Filter state
  const [typeFilter,  setTypeFilter]  = useState("");
  const [fromFilter,  setFromFilter]  = useState(monthStartStr());
  const [toFilter,    setToFilter]    = useState(todayStr());
  const [filterMode,  setFilterMode]  = useState("month"); // "month" | "custom"

  // Form state
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editId,     setEditId]     = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* ── Load suppliers once ────────────────────────────────────────────────── */
  useEffect(() => {
    getSuppliers()
      .then((res) => setSuppliers(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  /* ── Fetch expenses + summary ───────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const { from, to } =
        filterMode === "month"
          ? monthRange(selectedMonth)
          : { from: fromFilter, to: toFilter };

      const params = { from, to };
      if (typeFilter) params.expense_type = typeFilter;

      const [expRes, sumRes] = await Promise.all([
        getExpenses(params),
        getExpenseSummary({ from, to }),
      ]);

      setExpenses(expRes.data?.data ?? []);
      setSummary(sumRes.data?.data ?? null);
    } catch (err) {
      setFetchError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, filterMode, fromFilter, toFilter, typeFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Derived totals from backend summary ─────────────────────────────────── */
  const monthTotal     = summary?.total ?? 0;
  const purchaseTotal  = summary?.breakdown?.purchase ?? 0;
  const transportTotal = summary?.breakdown?.transport ?? 0;
  const miscTotal      = summary?.breakdown?.miscellaneous ?? 0;

  const selectedLabel =
    MONTH_OPTIONS.find((o) => o.value === selectedMonth)?.label || selectedMonth;

  /* ── Form helpers ────────────────────────────────────────────────────────── */
  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const setExpenseType = (type) =>
    setForm((f) => ({
      ...f,
      expense_type:  type,
      purchase_mode: "direct",
      total_bill:    "",
      quantity:      "",
      unit_cost:     "",
    }));

  // Computed total preview for itemised purchase mode
  const computedTotal = (() => {
    if (form.expense_type === "purchase" && form.purchase_mode === "itemised") {
      if (form.quantity && form.unit_cost)
        return parseFloat(form.quantity) * parseFloat(form.unit_cost);
    }
    return null;
  })();

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, expense_date: todayStr() });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (exp) => {
    const isPurchase = exp.expense_type === "purchase";
    const isItemised = isPurchase && exp.quantity != null && exp.unit_cost != null;

    setForm({
      expense_type:   exp.expense_type,
      purchase_mode:  isItemised ? "itemised" : "direct",
      supplier_id:    exp.supplier_id ?? "",
      description:    exp.description,
      total_bill:     !isItemised && isPurchase ? String(exp.total_amount) : "",
      quantity:       isItemised ? String(exp.quantity) : "",
      unit_cost:      isItemised
                        ? String(exp.unit_cost)
                        : !isPurchase
                        ? String(exp.total_amount)
                        : "",
      payment_method: exp.payment_method,
      expense_date:   exp.expense_date
        ? new Date(exp.expense_date).toISOString().slice(0, 10)
        : todayStr(),
      notes: exp.notes || "",
    });
    setEditId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); };

  /* ── Build & submit payload ──────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!form.description.trim()) { toast.warn("वर्णन भरा"); return; }

    const base = {
      expense_type:   form.expense_type,
      description:    form.description.trim(),
      payment_method: form.payment_method,
      expense_date:   form.expense_date || todayStr(),
      notes:          form.notes.trim() || undefined,
      supplier_id:    form.supplier_id || undefined,
    };

    if (form.expense_type === "purchase") {
      if (form.purchase_mode === "direct") {
        if (!form.total_bill || parseFloat(form.total_bill) <= 0) {
          toast.warn("एकूण बिल रक्कम भरा"); return;
        }
        base.total_bill = parseFloat(form.total_bill);
      } else {
        if (!form.unit_cost || parseFloat(form.unit_cost) <= 0) {
          toast.warn("प्रति नग किंमत भरा"); return;
        }
        if (!form.quantity || parseInt(form.quantity) <= 0) {
          toast.warn("प्रमाण भरा"); return;
        }
        base.unit_cost = parseFloat(form.unit_cost);
        base.quantity  = parseInt(form.quantity, 10);
      }
    } else {
      if (!form.unit_cost || parseFloat(form.unit_cost) <= 0) {
        toast.warn("रक्कम भरा"); return;
      }
      base.unit_cost = parseFloat(form.unit_cost);
    }

    setSubmitting(true);
    try {
      if (editId) {
        await updateExpense(editId, base);
        toast.success("खर्च अपडेट झाला ✅");
      } else {
        await createExpense(base);
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

  /* ── Delete ──────────────────────────────────────────────────────────────── */
  const handleDelete = async (id, description) => {
    if (!window.confirm(`"${description}" काढायचा आहे का?`)) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      toast.success("खर्च काढला ✅");
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      // Refresh summary silently
      const { from, to } =
        filterMode === "month"
          ? monthRange(selectedMonth)
          : { from: fromFilter, to: toFilter };
      getExpenseSummary({ from, to })
        .then((r) => setSummary(r.data?.data ?? null))
        .catch(() => {});
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="exp-page">

      {/* ── Sticky top summary ────────────────────────────────────────────── */}
      <div className="exp-summary-block">
        <div className="exp-summary-header">
          <div>
            <h2 className="exp-page-title">💸 खर्च</h2>
            <p className="exp-page-sub">ऑपरेटिंग खर्चाचा मागोवा</p>
          </div>
          {filterMode === "month" && (
            <select
              className="exp-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>

        <div className="exp-total-row">
          <span className="exp-total-label">
            {filterMode === "month" ? `${selectedLabel} — ` : ""}एकूण खर्च
          </span>
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

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="exp-filter-bar">
        <div className="exp-filter-mode-toggle">
          <button
            className={`exp-fmode-btn ${filterMode === "month" ? "active" : ""}`}
            onClick={() => setFilterMode("month")}
          >
            📅 महिना
          </button>
          <button
            className={`exp-fmode-btn ${filterMode === "custom" ? "active" : ""}`}
            onClick={() => setFilterMode("custom")}
          >
            🔍 कस्टम
          </button>
        </div>

        {filterMode === "custom" && (
          <div className="exp-custom-filters">
            <input
              type="date"
              className="exp-date-input"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
            />
            <span className="exp-filter-to">ते</span>
            <input
              type="date"
              className="exp-date-input"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
            />
            <button className="exp-search-btn" onClick={fetchAll}>शोधा</button>
          </div>
        )}

        <select
          className="exp-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">सर्व प्रकार</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
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

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!loading && expenses.length === 0 && !fetchError && (
        <div className="exp-empty">या कालावधीत कोणताही खर्च नाही</div>
      )}

      {/* ── List ─────────────────────────────────────────────────────────── */}
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
                  {exp.quantity && exp.unit_cost && (
                    <span className="exp-qty-badge">
                      {exp.quantity} × ₹{fmt(exp.unit_cost)}
                    </span>
                  )}
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

            {/* Expense type */}
            <div className="field">
              <label>प्रकार</label>
              <div className="exp-type-row">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`exp-type-btn ${form.expense_type === c.value ? "active" : ""}`}
                    onClick={() => setExpenseType(c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Purchase mode toggle */}
            {form.expense_type === "purchase" && (
              <div className="field">
                <label>नोंदवण्याची पद्धत</label>
                <div className="exp-mode-toggle">
                  <button
                    type="button"
                    className={`exp-mode-btn ${form.purchase_mode === "direct" ? "active" : ""}`}
                    onClick={() => setField("purchase_mode", "direct")}
                  >
                    💰 थेट बिल रक्कम
                  </button>
                  <button
                    type="button"
                    className={`exp-mode-btn ${form.purchase_mode === "itemised" ? "active" : ""}`}
                    onClick={() => setField("purchase_mode", "itemised")}
                  >
                    🧮 नग × किंमत
                  </button>
                </div>
                <p className="exp-mode-hint">
                  {form.purchase_mode === "direct"
                    ? "पुरवठादाराला दिलेली एकूण रक्कम थेट टाका"
                    : "प्रत्येक नगाची किंमत आणि प्रमाण टाका"}
                </p>
              </div>
            )}

            {/* Supplier — purchase only */}
            {form.expense_type === "purchase" && suppliers.length > 0 && (
              <div className="field">
                <label>पुरवठादार (ऐच्छिक)</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setField("supplier_id", e.target.value)}
                >
                  <option value="">— पुरवठादार निवडा —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div className="field">
              <label>
                {form.expense_type === "purchase"
                  ? form.purchase_mode === "direct"
                    ? "बिलाचे वर्णन *"
                    : "वस्तूचे नाव *"
                  : form.expense_type === "transport"
                  ? "वाहतूक विवरण *"
                  : "खर्चाचे विवरण *"}
              </label>
              <input
                type="text"
                placeholder={
                  form.expense_type === "purchase"
                    ? form.purchase_mode === "direct"
                      ? "उदा. जानेवारी माल बिल, पावती #123..."
                      : "उदा. साखर 50 kg, बिस्किट बॉक्स..."
                    : form.expense_type === "transport"
                    ? "उदा. टेम्पो, रिक्षा, पार्सल..."
                    : "उदा. वीज बिल, साफसफाई..."
                }
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                autoFocus
                maxLength={200}
              />
            </div>

            {/* Amount fields */}
            {form.expense_type === "purchase" && form.purchase_mode === "direct" ? (
              <div className="field">
                <label>एकूण बिल रक्कम (₹) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="उदा. 5000.00"
                  value={form.total_bill}
                  onChange={(e) => setField("total_bill", e.target.value)}
                />
              </div>
            ) : form.expense_type === "purchase" && form.purchase_mode === "itemised" ? (
              <div className="exp-amount-row">
                <div className="field">
                  <label>प्रमाण (qty) *</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="0"
                    value={form.quantity}
                    onChange={(e) => setField("quantity", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>प्रति नग किंमत (₹) *</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.unit_cost}
                    onChange={(e) => setField("unit_cost", e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="field">
                <label>रक्कम (₹) *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.unit_cost}
                  onChange={(e) => setField("unit_cost", e.target.value)}
                />
              </div>
            )}

            {/* Itemised total preview */}
            {computedTotal !== null && (
              <div className="exp-total-preview">
                एकूण: ₹{fmt(computedTotal)}
              </div>
            )}

            {/* Date */}
            <div className="field">
              <label>📅 तारीख</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setField("expense_date", e.target.value)}
              />
            </div>

            {/* Payment method */}
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

            {/* Notes */}
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
