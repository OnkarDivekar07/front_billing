import { useState, useEffect, useCallback } from "react";
import {
  getMissingItems,
  createMissingItem,
  incrementMissingItem,
  deleteMissingItem,
} from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";
import "./missingItems.css";

export default function MissingItems() {
  const toast = useToast();

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [inputName,  setInputName]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [bumpingId,  setBumpingId]  = useState(null);
  const [search,     setSearch]     = useState("");

  /* ── Fetch all ─────────────────────────────────────────────────── */
  const fetchItems = useCallback(async () => {
    setError(null);
    try {
      const res = await getMissingItems();
      const data = res.data?.data ?? [];
      // Sort: highest request count first, then alphabetical
      data.sort((a, b) =>
        b.requestCount - a.requestCount || a.name.localeCompare(b.name)
      );
      setItems(data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* ── Submit new item ────────────────────────────────────────────── */
  const handleSubmit = async () => {
    const name = inputName.trim();
    if (!name) { toast.warn("वस्तूचे नाव टाका"); return; }

    // Check duplicate (case-insensitive) before hitting server
    const exists = items.find(
      (i) => i.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      // Just bump the count instead of creating a duplicate
      await handleBump(exists.id, true);
      setInputName("");
      return;
    }

    setSubmitting(true);
    try {
      await createMissingItem(name);
      toast.success("वस्तू यादीत जोडली ✅");
      setInputName("");
      await fetchItems();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Bump request count ─────────────────────────────────────────── */
  const handleBump = async (id, silent = false) => {
    setBumpingId(id);
    try {
      const item = items.find((i) => i.id === id);
      await incrementMissingItem(id, (item?.requestCount ?? 0) + 1);
      if (!silent) toast.success("मागणी नोंदवली +1 ✅");
      await fetchItems();
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setBumpingId(null);
    }
  };

  /* ── Delete ─────────────────────────────────────────────────────── */
  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" यादीतून काढायची आहे का?`)) return;
    setDeletingId(id);
    try {
      await deleteMissingItem(id);
      toast.success("वस्तू काढली ✅");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Filtered list ──────────────────────────────────────────────── */
  const filtered = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : items;

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="mi-page">
      <h2 className="mi-title">🛒 नसलेल्या वस्तू</h2>
      <p className="mi-subtitle">
        दुकानात नसलेल्या वस्तू इथे नोंदवा. किती वेळा मागणी झाली ते दिसेल.
      </p>

      {/* ── Add new item ──────────────────────────────────────────── */}
      <div className="mi-add-box">
        <input
          className="mi-input"
          type="text"
          placeholder="वस्तूचे नाव टाका..."
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          maxLength={100}
          autoFocus
        />
        <button
          className="mi-add-btn"
          onClick={handleSubmit}
          disabled={submitting || !inputName.trim()}
        >
          {submitting ? "..." : "+ जोडा"}
        </button>
      </div>

      {/* ── Search filter ─────────────────────────────────────────── */}
      {items.length > 5 && (
        <input
          className="mi-search"
          type="text"
          placeholder="🔍 यादीत शोधा..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {/* ── States ────────────────────────────────────────────────── */}
      {error && <div className="mi-error">⚠️ {error}</div>}

      {loading ? (
        <div className="mi-status">लोड होत आहे...</div>
      ) : filtered.length === 0 ? (
        <div className="mi-empty">
          {search.trim()
            ? `"${search}" सापडले नाही`
            : "अजून कोणतीही वस्तू नोंदवलेली नाही"}
        </div>
      ) : (
        /* ── Item list ──────────────────────────────────────────── */
        <ul className="mi-list">
          {filtered.map((item) => (
            <li key={item.id} className="mi-row">

              {/* Left: name + badge */}
              <div className="mi-row-left">
                <span className="mi-name">{item.name}</span>
                <span
                  className={`mi-badge ${item.requestCount >= 5 ? "high" : item.requestCount >= 2 ? "mid" : ""}`}
                  title="किती वेळा मागणी झाली"
                >
                  × {item.requestCount}
                </span>
              </div>

              {/* Right: actions */}
              <div className="mi-row-actions">
                <button
                  className="mi-bump-btn"
                  onClick={() => handleBump(item.id)}
                  disabled={bumpingId === item.id}
                  title="मागणी +1 नोंदवा"
                >
                  {bumpingId === item.id ? "..." : "+1"}
                </button>
                <button
                  className="mi-del-btn"
                  onClick={() => handleDelete(item.id, item.name)}
                  disabled={deletingId === item.id}
                  title="काढा"
                >
                  {deletingId === item.id ? "..." : "✕"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Summary footer ────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <p className="mi-footer">
          एकूण {items.length} वस्तू &nbsp;·&nbsp; सर्वाधिक मागणी:{" "}
          <strong>{items[0]?.name}</strong> ({items[0]?.requestCount}×)
        </p>
      )}
    </div>
  );
}
