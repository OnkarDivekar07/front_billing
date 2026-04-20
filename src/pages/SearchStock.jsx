import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ProductSearchList from "../components/ProductSearchList";
import { createProduct } from "../api/endpoints";
import { extractError } from "../utils/extractError";
import { useToast } from "../components/Toast";

const NEW_EMPTY = {
  name:            "",
  quantity:        "",
  price:           "",
  lower_threshold: "",
  upper_threshold: "",
};

export default function SearchStock() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [showNewForm, setShowNewForm] = useState(false);
  const [newProduct,  setNewProduct]  = useState(NEW_EMPTY);
  const [newLoading,  setNewLoading]  = useState(false);

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) { toast.warn("Product name required"); return; }
    if (!newProduct.price || Number(newProduct.price) <= 0) {
      toast.warn("Price is required and must be greater than 0");
      return;
    }
    setNewLoading(true);
    try {
      await createProduct({
        name:            newProduct.name.trim(),
        quantity:        Number(newProduct.quantity)        || 0,
        price:           Number(newProduct.price),
        lower_threshold: Number(newProduct.lower_threshold) || 0,
        upper_threshold: Number(newProduct.upper_threshold) || 0,
      });
      toast.success("Product added.");
      setShowNewForm(false);
      setNewProduct(NEW_EMPTY);
    } catch (err) {
      toast.error(extractError(err));
    } finally {
      setNewLoading(false);
    }
  };

  return (
    <>
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
        footer={
          <div style={{ padding: "12px 0 4px" }}>
            <button
              className="primary-btn full"
              style={{ background: "#7c3aed", marginBottom: showNewForm ? 14 : 0 }}
              onClick={() => setShowNewForm((v) => !v)}
            >
              {showNewForm ? "✕ बंद करा" : "+ नवीन प्रॉडक्ट जोडा"}
            </button>

            {showNewForm && (
              <div style={{ marginTop: 4 }}>
                {[
                  { key: "name",            placeholder: "Product name",    type: "text"   },
                  { key: "quantity",        placeholder: "Quantity",        type: "number" },
                  { key: "price",           placeholder: "Price (₹) *",     type: "number" },
                  { key: "lower_threshold", placeholder: "Lower threshold", type: "number" },
                  { key: "upper_threshold", placeholder: "Upper threshold", type: "number" },
                ].map(({ key, placeholder, type }) => (
                  <div className="field" key={key}>
                    <input
                      type={type}
                      inputMode={type === "number" ? "numeric" : "text"}
                      placeholder={placeholder}
                      value={newProduct[key]}
                      onChange={(e) =>
                        setNewProduct((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
                <button
                  className="primary-btn full"
                  style={{ background: "#16a34a", marginTop: 4 }}
                  onClick={handleAddProduct}
                  disabled={newLoading}
                >
                  {newLoading ? "जोडत आहे..." : "Save Product"}
                </button>
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
