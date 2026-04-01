import { useState, useEffect, useCallback } from "react";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getBalanceSheet,
} from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./expenses.css";

/* ── constants ────────────────────────────────────────────────────────────── */
// expense_type values match backend ENUM: purchase | transport | miscellaneous
const CATEGORIES = [
  { value: "purchase",      label: "📦 खरेदी"   },
  { value: "transport",     label: "🚚 वाहतूक"   },
  { value: "miscellaneous", label: "📋 इतर"      },
];

const PAYMENT_METHODS = [
  { value: "cash",   label: "💵 रोख"    },
  { value: "online", label: "📲 ऑनलाईन" },
];

const RANGES = [
  { value: "today", label: "आज"           },
  { value: "week",  label: "या आठवड्यात"  },
  { value: "month", label: "या महिन्यात"  },
  { value: "year",  label: "या वर्षात"    },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const PAY_MAP = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Empty form uses real DB field names ──────────────────────────────────────
const EMPTY_FORM = {
  description:    "",
  total_amount:   "",
  expense_type:   "miscellaneous",
  payment_method: "cash",
  expense_date:   today(),
  notes:          "",
};

/* ── component ────────────────────────────────────────────────────────────── */
export default function Expenses() {
  const toast = useToast();

  const [expenses,     setExpenses]     = useState([]);
  const [range,        setRange]        = useState("month");
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState(null);

  const [sheet,        setSheet]        = useState(null);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [activeTab,    setActiveTab]    = useState("expenses");

  const [form,         setForm]         = useState(EMPTY_FORM);
  const [editId,       setEditId]       = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [deletingId,   setDeletingId]   = useState(null);

  /* ── fetch expenses ──────────────────────────────────────────────────────── */
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Backend getExpenses accepts { from, to, expense_type } — we pass range
      // via from/to computed from the range label so service buildDateRange works
      const now = new Date();
      let from, to;
      if (range === "today") {
        from = to = today();
      } else if (range === "week") {
        const s = new Date(now); s.setDate(now.getDate() - now.getDay());
        const e = new Date(s);   e.setDate(s.getDate() + 6);
        from = s.toISOString().slice(0, 10);
        to   = e.toISOString().slice(0, 10);
      } else if (range === "month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      } else if (range === "year") {
        from = `${now.getFullYear()}-01-01`;
        to   = `${now.getFullYear()}-12-31`;
      }
      const res = await getExpenses({ from, to });
      setExpenses(res.data?.data ?? []);
    } catch (err) {
      setFetchError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [range]);

  /* ── fetch balance sheet ─────────────────────────────────────────────────── */
  const fetchSheet = useCallback(async () => {
    setSheetLoading(true);
    try {
      const res = await getBalanceSheet(range);
      setSheet(res.data?.data ?? null);
    } catch {
      setSheet(null);
    } finally {
      setSheetLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchExpenses();
    fetchSheet();
  }, [fetchExpenses, fetchSheet]);

  /* ── form helpers ─────────────────────────────────────────────────────────── */
  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, expense_date: today() });
    setEditId(null);
    setShowForm(true);
  };

  // Populate form from a row — map DB fields → form fields
  const openEdit = (exp) => {
    setForm({
      description:    exp.description,
      total_amount:   String(exp.total_amount),
      expense_type:   exp.expense_type,
      payment_method: exp.payment_method,
      expense_date:   exp.expense_date
        ? new Date(exp.expense_date).toISOString().slice(0, 10)
        : today(),
      notes:          exp.notes || "",
    });
    setEditId(exp.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); };

  /* ── submit (create / update) ────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!form.description.trim()) { toast.warn("वर्णन भरा"); return; }
    if (!form.total_amount || Number(form.total_amount) <= 0) {
      toast.warn("योग्य रक्कम भरा"); return;
    }

    setSubmitting(true);
    try {
      // Payload uses exact backend field names
      const payload = {
        description:    form.description.trim(),
        // For edit: send as total_bill (direct mode) so service accepts it
        total_bill:     Number(form.total_amount),
        expense_type:   form.expense_type,
        payment_method: form.payment_method,
        expense_date:   form.expense_date || today(),
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
      await fetchExpenses();
      await fetchSheet();
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
      await fetchSheet();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeletingId(null);
    }
  };

  // Footer total — use total_amount (DB field)
  const listTotal = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0);

  /* ── render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="exp-page">
      {/* Header */}
      <div className="exp-header">
        <div className="exp-header-top">
          <div>
            <h2 className="exp-title">💸 खर्च &amp; बॅलन्स शीट</h2>
            <p className="exp-subtitle">दुकानाचे सर्व खर्च आणि नफा-तोटा येथे पाहा</p>
          </div>
          <button className="exp-add-btn" onClick={openAdd}>+ खर्च जोडा</button>
        </div>

        {/* Range selector */}
        <div className="exp-range-bar">
          {RANGES.map((r) => (
            <button
              key={r.value}
              className={`exp-range-btn ${range === r.value ? "active" : ""}`}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="exp-tabs">
          <button
            className={`exp-tab ${activeTab === "expenses" ? "active" : ""}`}
            onClick={() => setActiveTab("expenses")}
          >
            खर्च यादी
          </button>
          <button
            className={`exp-tab ${activeTab === "balance" ? "active" : ""}`}
            onClick={() => setActiveTab("balance")}
          >
            बॅलन्स शीट
          </button>
        </div>
      </div>

      {/* ── EXPENSES TAB ─────────────────────────────────────────────────── */}
      {activeTab === "expenses" && (
        <>
          {fetchError && <div className="exp-error">⚠️ {fetchError}</div>}

          {loading ? (
            <div className="exp-status">लोड होत आहे...</div>
          ) : expenses.length === 0 ? (
            <div className="exp-empty">
              या कालावधीत कोणताही खर्च नोंदवलेला नाही
            </div>
          ) : (
            <div className="exp-list-wrap">
              <ul className="exp-list">
                {expenses.map((exp) => (
                  <li key={exp.id} className="exp-row">
                    <div className="exp-row-left">
                      <div className="exp-row-top">
                        {/* description replaces title */}
                        <span className="exp-row-title">{exp.description}</span>
                        {/* total_amount replaces amount */}
                        <span className="exp-row-amount">₹{fmt(exp.total_amount)}</span>
                      </div>
                      <div className="exp-row-meta">
                        {/* expense_type replaces category */}
                        <span className="exp-cat-badge">
                          {CAT_MAP[exp.expense_type] || exp.expense_type}
                        </span>
                        {/* payment_method replaces paymentMethod */}
                        <span className="exp-pay-badge">
                          {PAY_MAP[exp.payment_method] || exp.payment_method}
                        </span>
                        {/* expense_date replaces date */}
                        <span className="exp-date">
                          {exp.expense_date
                            ? new Date(exp.expense_date).toLocaleDateString("en-IN")
                            : "—"}
                        </span>
                        {/* notes replaces note */}
                        {exp.notes && (
                          <span className="exp-note" title={exp.notes}>
                            📝 {exp.notes}
                          </span>
                        )}
                        {/* Show supplier name if present */}
                        {exp.Supplier && (
                          <span className="exp-note">🏪 {exp.Supplier.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="exp-row-actions">
                      <button className="exp-edit-btn" onClick={() => openEdit(exp)}>
                        ✏️
                      </button>
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

              <div className="exp-list-footer">
                <span>एकूण {expenses.length} खर्च</span>
                <span className="exp-list-total">₹{fmt(listTotal)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── BALANCE SHEET TAB ────────────────────────────────────────────── */}
      {activeTab === "balance" && (
        sheetLoading ? (
          <div className="exp-status">बॅलन्स शीट लोड होत आहे...</div>
        ) : !sheet ? (
          <div className="exp-error">बॅलन्स शीट लोड होऊ शकली नाही</div>
        ) : (
          <div className="bs-wrap">

            {/* Income card */}
            <div className="bs-card income">
              <h3 className="bs-card-title">📈 उत्पन्न (विक्री)</h3>
              <div className="bs-rows">
                <div className="bs-row">
                  <span>एकूण विक्री</span>
                  <strong>₹{fmt(sheet.income.totalSales)}</strong>
                </div>
                <div className="bs-row sub">
                  <span>रोख विक्री</span>
                  <span>₹{fmt(sheet.income.cashSales)}</span>
                </div>
                <div className="bs-row sub">
                  <span>ऑनलाईन विक्री</span>
                  <span>₹{fmt(sheet.income.onlineSales)}</span>
                </div>
                <div className="bs-row">
                  <span>एकूण नफा (किंमत वजा)</span>
                  <strong className={sheet.income.grossProfit >= 0 ? "green" : "red"}>
                    ₹{fmt(sheet.income.grossProfit)}
                  </strong>
                </div>
                <div className="bs-row sub">
                  <span>एकूण व्यवहार</span>
                  <span>{sheet.income.transactionCount}</span>
                </div>
              </div>
            </div>

            {/* Expenses card */}
            <div className="bs-card expenses">
              <h3 className="bs-card-title">💸 खर्च</h3>
              <div className="bs-rows">
                <div className="bs-row">
                  <span>एकूण खर्च</span>
                  <strong className="red">₹{fmt(sheet.expenses.total)}</strong>
                </div>
                {Object.entries(sheet.expenses.byCategory || {}).map(([cat, amt]) => (
                  <div key={cat} className="bs-row sub">
                    <span>{CAT_MAP[cat] || cat}</span>
                    <span>₹{fmt(amt)}</span>
                  </div>
                ))}
                {sheet.expenses.count === 0 && (
                  <div className="bs-row sub">
                    <span>कोणताही खर्च नाही</span><span>—</span>
                  </div>
                )}
              </div>
            </div>

            {/* Liabilities card */}
            <div className="bs-card liabilities">
              <h3 className="bs-card-title">⚠️ देणी (Repayments)</h3>
              <div className="bs-rows">
                <div className="bs-row">
                  <span>एकूण देणी</span>
                  <strong className="red">₹{fmt(sheet.liabilities.total)}</strong>
                </div>
                {sheet.liabilities.items.map((r) => (
                  <div key={r.id} className="bs-row sub">
                    <span>{r.supplierName}</span>
                    <span>₹{fmt(r.amountOwed)}</span>
                  </div>
                ))}
                {sheet.liabilities.count === 0 && (
                  <div className="bs-row sub">
                    <span>कोणतीही देणी नाही</span><span>—</span>
                  </div>
                )}
              </div>
            </div>

            {/* Summary card */}
            <div className={`bs-card summary ${sheet.summary.isProfit ? "profit" : "loss"}`}>
              <h3 className="bs-card-title">🧾 एकूण स्थिती</h3>
              <div className="bs-rows">
                <div className="bs-row">
                  <span>निव्वळ उत्पन्न (विक्री − खर्च)</span>
                  <strong className={sheet.summary.netIncome >= 0 ? "green" : "red"}>
                    ₹{fmt(sheet.summary.netIncome)}
                  </strong>
                </div>
                <div className="bs-row">
                  <span>देणी वजा केल्यावर</span>
                  <strong className={sheet.summary.netBalance >= 0 ? "green" : "red"}>
                    ₹{fmt(sheet.summary.netBalance)}
                  </strong>
                </div>
              </div>
              <div className={`bs-verdict ${sheet.summary.isProfit ? "profit" : "loss"}`}>
                {sheet.summary.isProfit ? "✅ फायदा" : "❌ तोटा"}
              </div>
            </div>

          </div>
        )
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

            {/* description (was: title) */}
            <div className="field">
              <label>वर्णन *</label>
              <input
                type="text"
                placeholder="उदा. जुलै भाडे, वीज बिल, माल खरेदी..."
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                autoFocus
                maxLength={200}
              />
            </div>

            {/* total_amount (was: amount) */}
            <div className="field">
              <label>रक्कम (₹) *</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0.00"
                value={form.total_amount}
                onChange={(e) => setField("total_amount", e.target.value)}
              />
            </div>

            {/* expense_type (was: category) */}
            <div className="field">
              <label>प्रकार</label>
              <select
                value={form.expense_type}
                onChange={(e) => setField("expense_type", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* expense_date (was: date) */}
            <div className="field">
              <label>तारीख</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setField("expense_date", e.target.value)}
              />
            </div>

            {/* payment_method (was: paymentMethod) */}
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

            {/* notes (was: note) */}
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
              <button
                className="exp-cancel-btn"
                onClick={closeForm}
                disabled={submitting}
              >
                रद्द करा
              </button>
              <button
                className="primary-btn"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "सेव्ह होत आहे..." : editId ? "बदला" : "जोडा"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
