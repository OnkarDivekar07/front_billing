import { useEffect, useState, useCallback } from "react";
import { getStockLogs, rollbackStockLog } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./stockUpdateLog.css";

const LS_DATE_KEY = "stock_log_selected_date";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getInitialDate() {
  try {
    const stored = localStorage.getItem(LS_DATE_KEY);
    const today  = getTodayStr();
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
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("mr-IN", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("mr-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function StockUpdateLog() {
  const [logs,        setLogs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [rollingBack, setRollingBack] = useState(null);
  const [error,       setError]       = useState(null);
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const toast = useToast();

  const handleDateChange = (e) => {
    const val = e.target.value;
    setSelectedDate(val);
    try { localStorage.setItem(LS_DATE_KEY, val); } catch {}
  };

  const fetchLogs = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStockLogs(date);
      setLogs(res.data?.data ?? []);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(selectedDate); }, [fetchLogs, selectedDate]);

  const handleRollback = async (log) => {
    const name = log.Product?.marathiName || log.Product?.name || log.productName;
    if (
      !window.confirm(
        `"${name}" साठी ${log.quantityAdded} नग जोडलेला स्टॉक परत काढायचा आहे का?`
      )
    )
      return;

    setRollingBack(log.id);
    try {
      await rollbackStockLog(log.id);
      toast.success("स्टॉक अपडेट रोलबॅक झाला ✅");
      fetchLogs(selectedDate);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setRollingBack(null);
    }
  };

  // ── Derived totals (only active, non-rolled-back logs) ──────────────────
  const activeLogs      = logs.filter((l) => !l.isRolledBack);
  const totalUnitsAdded = activeLogs.reduce((s, l) => s + (l.quantityAdded || 0), 0);
  const totalProducts   = new Set(activeLogs.map((l) => l.productId)).size;

  return (
    <div className="sul-page">
      <h2 className="sul-title">📦 स्टॉक अपडेट नोंदी</h2>

      {/* ── Date picker ──────────────────────────────────────────────────── */}
      <div className="sul-date-row">
        <label className="sul-date-label">📅 तारीख निवडा:</label>
        <input
          type="date"
          value={selectedDate}
          max={getTodayStr()}
          onChange={handleDateChange}
          className="sul-date-input"
        />
      </div>

      {/* ── Summary chips ────────────────────────────────────────────────── */}
      {!loading && !error && logs.length > 0 && (
        <div className="sul-summary">
          <div className="sul-chip">
            <span className="sul-chip-label">एकूण नोंदी</span>
            <span className="sul-chip-value">{logs.length}</span>
          </div>
          <div className="sul-chip">
            <span className="sul-chip-label">सक्रिय अपडेट</span>
            <span className="sul-chip-value">{activeLogs.length}</span>
          </div>
          <div className="sul-chip">
            <span className="sul-chip-label">एकूण युनिट जोडले</span>
            <span className="sul-chip-value">{totalUnitsAdded}</span>
          </div>
          <div className="sul-chip">
            <span className="sul-chip-label">प्रॉडक्ट्स</span>
            <span className="sul-chip-value">{totalProducts}</span>
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && <div className="sul-error">⚠️ {error}</div>}

      {/* ── Loading / empty ───────────────────────────────────────────────── */}
      {loading ? (
        <p className="sul-status">लोड होत आहे...</p>
      ) : logs.length === 0 && !error ? (
        <p className="sul-status">
          {formatDisplayDate(selectedDate)} रोजी कोणतीही स्टॉक अपडेट नोंद नाही
        </p>
      ) : (
        /* ── Table ─────────────────────────────────────────────────────── */
        <div className="sul-wrapper">
          <table className="sul-table">
            <thead>
              <tr>
                <th>#</th>
                <th>वेळ</th>
                <th>प्रॉडक्ट</th>
                <th>जोडले</th>
                <th>आधी → नंतर</th>
                <th>किंमत</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log, index) => {
                const displayName =
                  log.Product?.marathiName || log.Product?.name || log.productName;
                return (
                  <tr
                    key={log.id}
                    className={log.isRolledBack ? "is-rolled-back" : ""}
                  >
                    <td data-label="#">{index + 1}</td>

                    <td data-label="वेळ">
                      {formatDate(log.createdAt)}
                    </td>

                    <td data-label="प्रॉडक्ट">
                      <span style={{ fontWeight: 600 }}>{displayName}</span>
                      {log.Product?.marathiName && log.Product.name !== displayName && (
                        <span style={{ display: "block", fontSize: 11, color: "#9ca3af" }}>
                          {log.Product.name}
                        </span>
                      )}
                    </td>

                    <td data-label="जोडले">
                      <span className="qty-added">+{log.quantityAdded}</span>
                    </td>

                    <td data-label="आधी → नंतर">
                      <span style={{ color: "#6b7280" }}>{log.quantityBefore}</span>
                      <span className="qty-arrow">→</span>
                      <span className="qty-after">{log.quantityAfter}</span>
                    </td>

                    <td data-label="किंमत">
                      {log.priceAtUpdate != null
                        ? `₹${Number(log.priceAtUpdate).toFixed(2)}`
                        : <span style={{ color: "#9ca3af" }}>—</span>
                      }
                    </td>

                    <td data-label="Action">
                      {log.isRolledBack ? (
                        <span className="rolled-back-badge">Rolled Back</span>
                      ) : (
                        <button
                          className="rollback-btn"
                          onClick={() => handleRollback(log)}
                          disabled={rollingBack === log.id}
                        >
                          {rollingBack === log.id ? "..." : "Rollback"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* ── Footer summary ─────────────────────────────────────────── */}
            <tfoot>
              <tr>
                <td colSpan={3} className="sul-total-label">
                  एकूण (सक्रिय)
                </td>
                <td className="sul-total-value" data-label="एकूण जोडले">
                  +{totalUnitsAdded} युनिट
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
