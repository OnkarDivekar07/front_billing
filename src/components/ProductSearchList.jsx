import { useProductSearch } from "../hooks/useProductSearch";
import "../styles.css";
import "../pages/search.css";

/**
 * ProductSearchList — shared UI for searching products.
 * Used by SearchProducts (billing) and SearchStock (stock update).
 *
 * @param {string}   title     — heading text
 * @param {Function} onSelect  — called with the product object when a row is tapped
 * @param {Function} renderRow — optional custom row renderer (product) => ReactNode
 */
export default function ProductSearchList({ title, onSelect, renderRow, footer }) {
  const { filtered, search, setSearch, loading, error } = useProductSearch();

  return (
    <div className="page">
      <div className="card search-card">
        <h2 className="search-title">{title}</h2>

        <input
          className="search-input"
          type="text"
          inputMode="search"
          placeholder="प्रॉडक्टचे नाव टाका..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {error && <p className="error-msg">{error}</p>}

        {loading ? (
          <p className="loading" style={{ padding: "24px 0" }}>प्रॉडक्ट्स लोड होत आहे...</p>
        ) : (
          <div className="product-list">
            {filtered.length === 0 ? (
              <div className="no-result">प्रॉडक्ट सापडला नाही</div>
            ) : (
              filtered.map((product) => (
                <div
                  key={product.id}
                  className="product-row"
                  onClick={() => onSelect(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(product)}
                >
                  {renderRow ? renderRow(product) : (
                    <span>{product.marathiName || product.name}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {footer}
      </div>
    </div>
  );
}
