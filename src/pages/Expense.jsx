import { useState, useEffect, useCallback } from "react";
import {
  createExpense,
  getExpenses,
  deleteExpense,
  getRealBalanceSheet,
  getExpenseSummary,
  getSuppliers,
} from "../api/endpoints";
import { useToast } from "../components/Toast";
import "./expense.css";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayISO  = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

// ─── SummaryCards ─────────────────────────────────────────────────────────────
function SummaryCards({ summary }) {
  if (!summary) return null;
  const m = summary.month;
  return (
    <div className="expense-summary-grid">
      <div className="summary-card purchase">
        <div className="sc-label">📦 खरेदी (महिना)</div>
        <div className="sc-value">{fmt(m.purchase)}</div>
      </div>
      <div className="summary-card transport">
        <div className="sc-label">🚚 वाहतूक (महिना)</div>
        <div className="sc-value">{fmt(m.transport)}</div>
      </div>
      <div className="summary-card misc">
        <div className="sc-label">📝 इतर (महिना)</div>
        <div className="sc-value">{fmt(m.miscellaneous)}</div>
      </div>
      <div className="summary-card total">
        <div className="sc-label">💰 एकूण (महिना)</div>
        <div className="sc-value">{fmt(m.total)}</div>
      </div>
    </div>
  );
}

// ─── AddExpenseForm ────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  expense_type:   "purchase",
  purchase_mode:  "direct",      // "direct" | "itemised"  (purchase only)
  supplier_id:    "",
  description:    "",
  total_bill:     "",            // Mode B — direct total paid to supplier
  quantity:       "",            // Mode A — itemised
  unit_cost:      "",            // Mode A — per item cost  / transport+misc amount
  payment_method: "cash",
  notes:          "",
  expense_date:   todayISO(),
};

function AddExpenseForm({ suppliers, onSaved }) {
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { success, error }  = useToast();

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // When switching expense_type reset purchase_mode to direct
  const setType = (type) =>
    setForm((f) => ({ ...f, expense_type: type, purchase_mode: "direct", total_bill: "", quantity: "", unit_cost: "" }));

  // Preview total
  const computedTotal = (() => {
    if (form.expense_type === "purchase") {
      if (form.purchase_mode === "direct") {
        return form.total_bill ? parseFloat(form.total_bill).toFixed(2) : null;
      }
      if (form.quantity && form.unit_cost)
        return (parseFloat(form.quantity) * parseFloat(form.unit_cost)).toFixed(2);
      return null;
    }
    return form.unit_cost ? parseFloat(form.unit_cost).toFixed(2) : null;
  })();

  const handleSubmit = async () => {
    if (!form.description.trim()) return error("वर्णन आवश्यक आहे");

    // Build payload based on mode
    const payload = {
      expense_type:   form.expense_type,
      supplier_id:    form.supplier_id || undefined,
      description:    form.description.trim(),
      payment_method: form.payment_method,
      notes:          form.notes.trim() || undefined,
      expense_date:   form.expense_date,
    };

    if (form.expense_type === "purchase") {
      if (form.purchase_mode === "direct") {
        // ── Mode B ──
        if (!form.total_bill || parseFloat(form.total_bill) <= 0)
          return error("एकूण बिल रक्कम आवश्यक आहे");
        payload.total_bill = parseFloat(form.total_bill);
      } else {
        // ── Mode A ──
        if (!form.unit_cost || parseFloat(form.unit_cost) <= 0)
          return error("प्रति नग किंमत आवश्यक आहे");
        if (!form.quantity || parseInt(form.quantity) <= 0)
          return error("खरेदीसाठी प्रमाण आवश्यक आहे");
        payload.unit_cost = parseFloat(form.unit_cost);
        payload.quantity  = parseInt(form.quantity);
      }
    } else {
      // transport / misc
      if (!form.unit_cost || parseFloat(form.unit_cost) <= 0)
        return error("रक्कम आवश्यक आहे");
      payload.unit_cost = parseFloat(form.unit_cost);
    }

    setSaving(true);
    try {
      await createExpense(payload);
      success("खर्च नोंदवला ✓");
      setForm({ ...EMPTY_FORM, expense_date: form.expense_date });
      onSaved();
    } catch (err) {
      error(err?.response?.data?.message || "Error saving expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="expense-form-card">
      <h2>➕ नवीन खर्च नोंदवा</h2>

      {/* Expense type pills */}
      <div className="form-group">
        <label>खर्चाचा प्रकार</label>
        <div className="type-pills">
          {[
            { value: "purchase",      label: "📦 खरेदी" },
            { value: "transport",     label: "🚚 वाहतूक" },
            { value: "miscellaneous", label: "📝 इतर"   },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              className={`type-pill ${form.expense_type === t.value ? `selected-${t.value}` : ""}`}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Purchase-specific: mode toggle ─────────────────────────────── */}
      {form.expense_type === "purchase" && (
        <div className="form-group">
          <label>खरेदी नोंदवण्याची पद्धत</label>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${form.purchase_mode === "direct" ? "active" : ""}`}
              onClick={() => set("purchase_mode", "direct")}
            >
              💰 थेट बिल रक्कम
            </button>
            <button
              type="button"
              className={`mode-btn ${form.purchase_mode === "itemised" ? "active" : ""}`}
              onClick={() => set("purchase_mode", "itemised")}
            >
              🧮 नग × किंमत
            </button>
          </div>
          <p className="mode-hint">
            {form.purchase_mode === "direct"
              ? "पुरवठादाराला दिलेली एकूण रक्कम थेट टाका"
              : "प्रत्येक नगाची किंमत आणि प्रमाण टाका"}
          </p>
        </div>
      )}

      {/* Supplier — only for purchase type */}
      {form.expense_type === "purchase" && (
        <div className="form-group">
          <label>पुरवठादार (ऐच्छिक)</label>
          <select value={form.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}>
            <option value="">— पुरवठादार निवडा —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div className="form-group">
        <label>
          {form.expense_type === "purchase"
            ? (form.purchase_mode === "direct" ? "बिलाचे वर्णन / पावती तपशील" : "वस्तूचे नाव / विवरण")
            : form.expense_type === "transport" ? "वाहतूक विवरण" : "खर्चाचे विवरण"}
        </label>
        <input
          type="text"
          placeholder={
            form.expense_type === "purchase"
              ? (form.purchase_mode === "direct"
                  ? "उदा. जानेवारी माल बिल, पावती #123..."
                  : "उदा. साखर 50 kg, बिस्किट बॉक्स...")
              : form.expense_type === "transport"
              ? "उदा. टेम्पो, रिक्षा, पार्सल..."
              : "उदा. वीज बिल, साफसफाई..."}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      {/* ── Amount fields ───────────────────────────────────────────── */}
      {form.expense_type === "purchase" && form.purchase_mode === "direct" ? (
        /* Mode B — single total bill amount */
        <div className="form-group">
          <label>एकूण बिल रक्कम (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="उदा. 5000.00"
            value={form.total_bill}
            onChange={(e) => set("total_bill", e.target.value)}
            autoFocus
          />
        </div>
      ) : form.expense_type === "purchase" && form.purchase_mode === "itemised" ? (
        /* Mode A — qty × unit_cost */
        <div className="form-row">
          <div className="form-group">
            <label>प्रमाण (qty)</label>
            <input
              type="number" min="1" placeholder="0"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>प्रति नग किंमत (₹)</label>
            <input
              type="number" min="0" step="0.01" placeholder="0.00"
              value={form.unit_cost}
              onChange={(e) => set("unit_cost", e.target.value)}
            />
          </div>
        </div>
      ) : (
        /* transport / miscellaneous — single amount */
        <div className="form-group">
          <label>रक्कम (₹)</label>
          <input
            type="number" min="0" step="0.01" placeholder="0.00"
            value={form.unit_cost}
            onChange={(e) => set("unit_cost", e.target.value)}
          />
        </div>
      )}

      {/* Computed total preview */}
      {computedTotal && (
        <div className="total-preview">एकूण: {fmt(computedTotal)}</div>
      )}

      {/* Payment method + Date */}
      <div className="form-row">
        <div className="form-group">
          <label>पैसे कसे दिले</label>
          <select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
            <option value="cash">💵 रोख</option>
            <option value="online">📱 ऑनलाइन</option>
          </select>
        </div>
        <div className="form-group">
          <label>तारीख</label>
          <input type="date" value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} />
        </div>
      </div>

      {/* Notes */}
      <div className="form-group">
        <label>नोट्स / बिल नंबर (ऐच्छिक)</label>
        <textarea
          placeholder="बिल नंबर, संदर्भ..."
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
        {saving ? "जतन होत आहे..." : "💾 खर्च जतन करा"}
      </button>
    </div>
  );
}

// ─── ExpenseList ───────────────────────────────────────────────────────────────
function ExpenseList({ onDeleted }) {
  const [expenses,    setExpenses]   = useState([]);
  const [loading,     setLoading]    = useState(false);
  const [from,        setFrom]       = useState(monthStart());
  const [to,          setTo]         = useState(todayISO());
  const [typeFilter,  setTypeFilter] = useState("");
  const { success, error } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExpenses({ from, to, ...(typeFilter ? { expense_type: typeFilter } : {}) });
      setExpenses(res.data.data || []);
    } catch {
      error("खर्च लोड करताना त्रुटी");
    } finally {
      setLoading(false);
    }
  }, [from, to, typeFilter, error]);

  useEffect(() => { load(); }, []); // eslint-disable-line
  useEffect(() => { onDeleted.current = load; }, [load, onDeleted]);

  const handleDelete = async (id) => {
    if (!window.confirm("हा खर्च काढायचा आहे?")) return;
    try {
      await deleteExpense(id);
      success("खर्च काढला ✓");
      load();
    } catch {
      error("काढताना त्रुटी");
    }
  };

  const typeLabel = { purchase: "खरेदी", transport: "वाहतूक", miscellaneous: "इतर" };
  const typeIcon  = { purchase: "📦",    transport: "🚚",     miscellaneous: "📝"  };

  return (
    <div>
      <div className="expense-list-controls">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">सर्व प्रकार</option>
          <option value="purchase">📦 खरेदी</option>
          <option value="transport">🚚 वाहतूक</option>
          <option value="miscellaneous">📝 इतर</option>
        </select>
        <button className="btn-filter" onClick={load}>🔍 शोधा</button>
      </div>

      {loading && <div className="loading-spinner">लोड होत आहे...</div>}
      {!loading && expenses.length === 0 && (
        <div className="expense-empty">या कालावधीत कोणतीही नोंद नाही.</div>
      )}

      {expenses.map((exp) => (
        <div className="expense-item" key={exp.id}>
          <div className="expense-item-left">
            <div className="expense-item-top">
              <span className="expense-item-desc">{exp.description}</span>
              <span className={`expense-badge badge-${exp.expense_type}`}>
                {typeIcon[exp.expense_type]} {typeLabel[exp.expense_type]}
              </span>
            </div>
            <div className="expense-item-meta">
              {exp.Supplier ? `🏪 ${exp.Supplier.name} · ` : ""}
              {exp.quantity && exp.unit_cost
                ? `Qty: ${exp.quantity} × ₹${exp.unit_cost} · `
                : ""}
              {new Date(exp.expense_date).toLocaleDateString("en-IN")}
              {exp.notes ? ` · ${exp.notes}` : ""}
            </div>
          </div>
          <div className="expense-item-right">
            <span className="expense-amount">{fmt(exp.total_amount)}</span>
            <span className={`payment-badge payment-${exp.payment_method}`}>
              {exp.payment_method === "cash" ? "💵 रोख" : "📱 ऑनलाइन"}
            </span>
            <button className="btn-delete-expense" onClick={() => handleDelete(exp.id)} title="काढा">🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── BalanceSheetView ──────────────────────────────────────────────────────────
function BalanceSheetView() {
  const [sheet,           setSheet]           = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [expandInventory, setExpandInventory] = useState(false);
  const [expandSupplier,  setExpandSupplier]  = useState(false);
  const { error } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getRealBalanceSheet();
      setSheet(res.data.data);
    } catch {
      error("बॅलन्स शीट लोड करताना त्रुटी");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const isProfit = sheet ? sheet.equity >= 0 : true;

  return (
    <div className="balance-sheet">
      <div className="bs-header-row">
        <h2>🏦 Real Balance Sheet</h2>
        <button className="btn-filter" onClick={load} style={{ marginLeft: "auto" }}>🔄 Refresh</button>
      </div>
      {sheet && (
        <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginBottom: "1rem" }}>
          {new Date(sheet.generatedAt).toLocaleString("en-IN")} रोजी तयार केले
        </div>
      )}
      {loading && <div className="loading-spinner">गणना होत आहे...</div>}
      {!loading && sheet && (
        <>
          {/* ASSETS */}
          <div className="bs-section">
            <div className="bs-section-title bs-assets-title">📈 मालमत्ता (Assets)</div>
            <div className="bs-block">
              <div className="bs-row bold"><span>💵 रोख (Cash)</span><span className="bs-val bs-positive">{fmt(sheet.assets.cash.value)}</span></div>
              <div className="bs-row indent"><span>↑ रोख विक्री (Inflow)</span><span className="bs-val">{fmt(sheet.assets.cash.inflow)}</span></div>
              <div className="bs-row indent"><span>↓ रोख खर्च (Outflow)</span><span className="bs-val" style={{ color: "#dc2626" }}>− {fmt(sheet.assets.cash.outflow)}</span></div>
            </div>
            <div className="bs-block">
              <div className="bs-row bold"><span>📦 माल साठा (Inventory)</span><span className="bs-val bs-positive">{fmt(sheet.assets.inventory.value)}</span></div>
              <div className="bs-row indent">
                <span style={{ color: "#6b7280" }}>
                  {sheet.assets.inventory.itemCount} प्रकारचे उत्पादन{" · "}
                  <button className="bs-expand-btn" onClick={() => setExpandInventory((v) => !v)}>
                    {expandInventory ? "▲ लपवा" : "▼ तपशील"}
                  </button>
                </span>
              </div>
              {expandInventory && sheet.assets.inventory.items.length > 0 && (
                <div className="bs-drill-table">
                  <div className="bs-drill-header"><span>उत्पादन</span><span>Qty</span><span>किंमत</span><span>मूल्य</span></div>
                  {sheet.assets.inventory.items.map((item) => (
                    <div className="bs-drill-row" key={item.id}>
                      <span>{item.name}</span><span>{item.quantity}</span><span>{fmt(item.costPrice)}</span><span>{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bs-block">
              <div className="bs-row bold"><span>📱 प्राप्य (Receivables)</span><span className="bs-val">{fmt(sheet.assets.receivables.value)}</span></div>
              <div className="bs-row indent"><span style={{ color: "#6b7280", fontSize: "0.78rem" }}>ऑनलाइन विक्री {fmt(sheet.assets.receivables.onlineRevenue)} — UPI/card द्वारे आधीच मिळाले</span></div>
            </div>
            <div className="bs-total-row assets"><span>एकूण मालमत्ता</span><span>{fmt(sheet.assets.total)}</span></div>
          </div>

          <hr className="bs-divider" />

          {/* LIABILITIES */}
          <div className="bs-section">
            <div className="bs-section-title bs-liab-title">📉 देणी (Liabilities)</div>
            <div className="bs-block">
              <div className="bs-row bold"><span>🏪 पुरवठादार देणे (Supplier Dues)</span><span className="bs-val" style={{ color: "#dc2626" }}>{fmt(sheet.liabilities.supplierDues.value)}</span></div>
              {sheet.liabilities.supplierDues.entries.length > 0 ? (
                <>
                  <div className="bs-row indent">
                    <span>{sheet.liabilities.supplierDues.entries.length} नोंदी{" · "}
                      <button className="bs-expand-btn" onClick={() => setExpandSupplier((v) => !v)}>
                        {expandSupplier ? "▲ लपवा" : "▼ तपशील"}
                      </button>
                    </span>
                  </div>
                  {expandSupplier && (
                    <div className="bs-drill-table">
                      <div className="bs-drill-header"><span>पुरवठादार</span><span>देय तारीख</span><span>रक्कम</span></div>
                      {sheet.liabilities.supplierDues.entries.map((e, i) => (
                        <div className="bs-drill-row" key={i}>
                          <span>{e.supplier}</span>
                          <span>{new Date(e.dueDate).toLocaleDateString("en-IN")}</span>
                          <span style={{ color: "#dc2626" }}>{fmt(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="bs-row indent" style={{ color: "#6b7280" }}>कोणतेही पुरवठादार देणे नाही ✓</div>
              )}
            </div>
            <div className="bs-total-row liabilities"><span>एकूण देणी</span><span>{fmt(sheet.liabilities.total)}</span></div>
          </div>

          <hr className="bs-divider" />

          {/* EQUITY */}
          <div className={`bs-equity-box ${isProfit ? "profit" : "loss"}`}>
            <div className="bs-equity-formula">Assets − Liabilities = Equity</div>
            <div className="bs-equity-calc">{fmt(sheet.assets.total)} − {fmt(sheet.liabilities.total)}</div>
            <div className="bs-equity-result">
              {isProfit ? "✅" : "❌"} मालकी हक्क (Equity)
              <span>{fmt(Math.abs(sheet.equity))}</span>
            </div>
          </div>
          <div className="bs-formula-note">
            <span>मालमत्ता = रोख + माल साठा + प्राप्य</span>
            <span>देणी = पुरवठादार देणे</span>
            <span>Equity = मालमत्ता − देणी</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Expense() {
  const [tab,       setTab]       = useState("add");
  const [suppliers, setSuppliers] = useState([]);
  const [summary,   setSummary]   = useState(null);

  const reloadListRef = { current: null };

  const loadSummary = async () => {
    try {
      const res = await getExpenseSummary();
      setSummary(res.data.data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    getSuppliers().then((res) => setSuppliers(res.data.data || [])).catch(() => {});
    loadSummary();
  }, []);

  const handleSaved = () => {
    loadSummary();
    if (reloadListRef.current) reloadListRef.current();
  };

  return (
    <div className="expense-page">
      <h1>💸 खर्च व्यवस्थापन</h1>
      <SummaryCards summary={summary} />
      <div className="expense-tabs">
        <button className={tab === "add"     ? "active" : ""} onClick={() => setTab("add")}>➕ खर्च नोंदवा</button>
        <button className={tab === "list"    ? "active" : ""} onClick={() => setTab("list")}>📋 खर्च यादी</button>
        <button className={tab === "balance" ? "active" : ""} onClick={() => setTab("balance")}>📊 बॅलन्स शीट</button>
      </div>
      {tab === "add"     && <AddExpenseForm suppliers={suppliers} onSaved={handleSaved} />}
      {tab === "list"    && <ExpenseList onDeleted={reloadListRef} />}
      {tab === "balance" && <BalanceSheetView />}
    </div>
  );
}
