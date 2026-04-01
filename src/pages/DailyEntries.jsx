import { useEffect, useState, useCallback } from "react";
import { getDailyTransactions, rollbackTransaction } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./dailyEntries.css";

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
  const toast = useToast();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDailyTransactions();
      setTransactions(res.data?.data ?? []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleRollback = async (id) => {
    if (!window.confirm("तुम्हाला ही transaction rollback करायची आहे का?")) return;
    setRollingBack(id);
    try {
      await rollbackTransaction(id);
      toast.success("Transaction rollback झाली ✅");
      fetchTransactions();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setRollingBack(null);
    }
  };

  const dailyTotal = transactions.reduce(
    (sum, t) => sum + Number(t.totalAmount || 0), 0
  );

  return (
    <div className="entries-page">
      <h2 className="entries-title">📘 दैनंदिन व्यवहार</h2>

      {error && (
        <div className="entries-error">⚠️ {error}</div>
      )}

      {loading ? (
        <p className="entries-status">लोड होत आहे...</p>
      ) : transactions.length === 0 ? (
        <p className="entries-status">आज कोणतीही नोंद नाही</p>
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
                <td colSpan="4" className="total-label">आजची एकूण विक्री</td>
                <td className="total-amount">₹{dailyTotal.toFixed(2)}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
