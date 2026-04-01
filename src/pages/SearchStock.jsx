import { useNavigate } from "react-router-dom";
import ProductSearchList from "../components/ProductSearchList";

export default function SearchStock() {
  const navigate = useNavigate();

  return (
    <ProductSearchList
      title="📦 स्टॉक अपडेट"
      onSelect={(product) => navigate(`/add-stock/${product.id}`)}
      renderRow={(product) => {
        const isLow = product.quantity <= product.lower_threshold;
        return (
          <>
            <span>{product.marathiName || product.name}</span>
            <span className={`stock-badge ${isLow ? "low" : ""}`}>
              {product.quantity} {isLow ? "⚠" : ""}
            </span>
          </>
        );
      }}
    />
  );
}
