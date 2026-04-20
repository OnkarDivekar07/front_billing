import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProductSearch } from "../hooks/useProductSearch";
import BillingModal from "../components/BillingModal";
import { getTodayCustomerCount, updateCustomerCount } from "../api/endpoints";
import "../styles.css";
import "./home.css";

export default function Home() {
  const navigate = useNavigate();
  const { filtered, search, setSearch, loading, error } = useProductSearch();
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ── Customer Count ────────────────────────────────────────────────────────
  const [todayCount,  setTodayCount]  = useState(null);
  const [countInput,  setCountInput]  = useState("");
  const [countSaving, setCountSaving] = useState(false);
  const [countSaved,  setCountSaved]  = useState(false);

  useEffect(() => {
    getTodayCustomerCount()
      .then((res) => {
        const c = res.data?.data?.count ?? res.data?.count ?? 0;
        setTodayCount(c);
      })
      .catch(() => setTodayCount(0));
  }, []);

  const saveCount = async () => {
    const target = parseInt(countInput, 10);
    if (!countInput || isNaN(target) || target < 0) return;

    const current = todayCount ?? 0;
    const diff    = target - current;
    if (diff === 0) { setCountInput(""); return; }

    setCountSaving(true);
    try {
      // Backend incrementCount/decrementCount moves by 1 per call.
      // We loop Math.abs(diff) times with step +1 or -1.
      const step  = diff > 0 ? 1 : -1;
      const steps = Math.abs(diff);
      let latest  = current;

      for (let i = 0; i < steps; i++) {
        const res = await updateCustomerCount(step);
        latest = res.data?.data?.count ?? res.data?.count ?? (latest + step);
      }

      setTodayCount(latest);
      setCountInput("");
      setCountSaved(true);
      setTimeout(() => setCountSaved(false), 2000);
    } catch {
      // count display may be stale; page remains usable
    } finally {
      setCountSaving(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleCardClick     = (product) => setSelectedProduct(product);
  const handleModalClose    = () => setSelectedProduct(null);
  const handleBillingSuccess = () => {
    setSelectedProduct(null);
    navigate("/success");
  };

  return (
    <div className="home-page">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="home-topbar">
        <div className="home-topbar-inner">
          <h1 className="home-title">अद्विका ऑटो</h1>
          <button
            className="scan-btn"
            onClick={() => navigate("/scan")}
            title="QR स्कॅन करा"
          >
            📷
          </button>
        </div>

        <input
          className="home-search"
          type="text"
          inputMode="search"
          placeholder="🔍 मराठी / English मध्ये प्रॉडक्ट शोधा..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Customer Count Bar ───────────────────────────────────── */}
      <div className="customer-count-bar">
        <div className="customer-count-left">
          <span className="customer-count-icon">👥</span>
          <span className="customer-count-label">आजचे ग्राहक</span>
          <span className="customer-count-value">
            {todayCount === null ? "..." : todayCount}
          </span>
        </div>
        <div className="customer-count-right">
          <input
            className="customer-count-input"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="संख्या"
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCount()}
          />
          <button
            className={`customer-count-btn ${countSaved ? "saved" : ""}`}
            onClick={saveCount}
            disabled={countSaving || !countInput}
          >
            {countSaved ? "✓" : countSaving ? "..." : "सेव्ह"}
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="home-content">

        {loading && (
          <div className="home-loading">
            <div className="home-spinner" />
            <p>प्रॉडक्ट्स लोड होत आहे...</p>
          </div>
        )}

        {error && !loading && (
          <div className="home-error">⚠️ {error}</div>
        )}

        {!loading && !error && filtered.length === 0 && search.trim() && (
          <div className="home-empty">
            <p>&ldquo;{search}&rdquo; साठी कोणताही प्रॉडक्ट सापडला नाही</p>
          </div>
        )}

        {!loading && (
          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => handleCardClick(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Billing modal ────────────────────────────────────────── */}
      {selectedProduct && (
        <BillingModal
          product={selectedProduct}
          onClose={handleModalClose}
          onSuccess={handleBillingSuccess}
        />
      )}
    </div>
  );
}

/* ─── Product Card ─────────────────────────────────────────────────────── */
function ProductCard({ product, onClick }) {
  const isLowStock = product.quantity <= (product.lower_threshold ?? 0);

  return (
    <div
      className="product-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="card-image-wrap">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.marathiName || product.name}
            className="card-image"
            loading="lazy"
          />
        ) : (
          <div className="card-image-placeholder">🛒</div>
        )}
      </div>

      <div className="card-names">
        {product.marathiName && (
          <p className="card-name-marathi">{product.marathiName}</p>
        )}
        <p className="card-name-english">{product.name}</p>
      </div>

      <div className="card-footer">
        <span className="card-unit">
          {product.defaultUnit === "jodi"  ? "जोडी"  :
           product.defaultUnit === "dozen" ? "डझन"   : "नग"}
        </span>
        <span className={`card-stock ${isLowStock ? "low" : ""}`}>
          {product.quantity}{isLowStock ? " ⚠" : ""}
        </span>
      </div>
    </div>
  );
}
