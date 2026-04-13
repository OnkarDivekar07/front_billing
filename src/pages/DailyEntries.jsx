import { useEffect, useState, useCallback } from "react";
import { getDailyTransactions, rollbackTransaction } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./dailyEntries.css";

const LS_DATE_KEY = "billing_selected_date";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialDate() {
  try {
    const stored = localStorage.getItem(LS_DATE_KEY);
    const today  = getTodayStr();
    // Auto-reset to today if no stored date OR stored date is from a previous day
    if (!stored || stored !== today) {
      localStorage.setItem(LS_DATE_KEY, today);
      return today;
    }
    return stored;
  } catch {
    return getTodayStr();
  }
}

function formatDate(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("mr-IN");
}

export default function DailyEntries() {
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [rollingBack,  setRollingBack]  = useState(null);
  const [error,        setError]        = useState(null);
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const toast = useToast();

  // Persist date whenever user manually changes it
  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    try { localStorage.setItem(LS_DATE_KEY, val); } catch {}
  };

  const fetchTransactions = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDailyTransactions(date);
      setTransactions(res.data?.data ?? []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(selectedDate); }, [fetchTransactions, selectedDate]);

  const handleRollback = async (id) => {
    if (!window.confirm("तुम्हाला ही transaction rollback करायची आहे का?")) return;
    setRollingBack(id);
    try {
      await rollbackTransaction(id);
      toast.success("Transaction rollback झाली ✅");
      fetchTransactions(selectedDate);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setRollingBack(null);
    }
  };

  const dailyTotal = transactions.reduce(
    (sum, t) => sum + Number(t.totalAmount || 0), 0
  );

  const dailyProfit = transactions.reduce(
    (sum, t) => sum + Number(t.profit || 0), 0
  );

  return (
    <div className="entries-page">
      <h2 className="entries-title">📘 दैनंदिन व्यवहार</h2>

      {/* Date Selector */}
      <div className="entries-date-row">
        <label className="entries-date-label">📅 तारीख निवडा:</label>
        <input
          type="date"
          value={selectedDate}
          max={getTodayStr()}
          onChange={handleDateChange}
          className="entries-date-input"
        />
      </div>

      {error && (
        <div className="entries-error">⚠️ {error}</div>
      )}

      {loading ? (
        <p className="entries-status">लोड होत आहे...</p>
      ) : transactions.length === 0 ? (
        <p className="entries-status">या तारखेला कोणतीही नोंद नाही</p>
      ) : (
        <div className="entries-wrapper">
          <table className="entries-table">
            <thead>
              <tr>
                <th>#</th>
                <th>तारीख</th>
                <th>वस्तू</th>
                <th>प्रमाण</th>
                <th>एकूण</th>
                <th>नफा</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((txn, index) => (
                <tr key={txn.id ?? index}>
                  <td data-label="#">{index + 1}</td>
                  <td data-label="तारीख">{formatDate(txn.date)}</td>
                  <td data-label="वस्तू">{txn.itemsPurchased ?? "—"}</td>
                  <td data-label="प्रमाण">{txn.quantity ?? "—"}</td>
                  <td data-label="एकूण" className="amount">
                    ₹{Number(txn.totalAmount || 0).toFixed(2)}
                  </td>
                  <td
                    data-label="नफा"
                    className="amount"
                    style={{ color: (txn.profit ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}
                  >
                    ₹{Number(txn.profit || 0).toFixed(2)}
                  </td>
                  <td data-label="Action">
                    {txn.isReversed ? (
                      <span className="reversed-badge">Reversed</span>
                    ) : (
                      <button
                        className="rollback-btn"
                        onClick={() => handleRollback(txn.id)}
                        disabled={rollingBack === txn.id}
                      >
                        {rollingBack === txn.id ? "..." : "Rollback"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan="4" className="total-label">एकूण विक्री</td>
                <td className="total-amount">₹{dailyTotal.toFixed(2)}</td>
                <td className="total-amount" style={{ color: dailyProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                  ₹{dailyProfit.toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
