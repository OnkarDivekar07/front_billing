import { useNavigate } from "react-router-dom";
import ProductSearchList from "../components/ProductSearchList";

export default function SearchProducts() {
  const navigate = useNavigate();

  return (
    <ProductSearchList
      title="🔍 प्रॉडक्ट शोधा"
      onSelect={(product) => navigate(`/billing/${product.id}`)}
      renderRow={(product) => (
        <span>{product.marathiName || product.name}</span>
      )}
    />
  );
}
