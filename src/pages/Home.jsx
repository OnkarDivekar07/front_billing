import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProductSearch } from "../hooks/useProductSearch";
import BillingModal from "../components/BillingModal";
import "../styles.css";
import "./home.css";

export default function Home() {
  const navigate = useNavigate();
  const { filtered, search, setSearch, loading, error } = useProductSearch();
  const [selectedProduct, setSelectedProduct] = useState(null);

  const handleCardClick    = (product) => setSelectedProduct(product);
  const handleModalClose   = () => setSelectedProduct(null);
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

        {/* Only show empty state when there's an active search term */}
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
      {/* Image */}
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

      {/* Names */}
      <div className="card-names">
        {product.marathiName && (
          <p className="card-name-marathi">{product.marathiName}</p>
        )}
        <p className="card-name-english">{product.name}</p>
      </div>

      {/* Footer: unit left, stock right */}
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
