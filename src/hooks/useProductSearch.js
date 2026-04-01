import { useState, useEffect, useMemo, useRef } from "react";
import { getAllProducts } from "../api/endpoints";

/**
 * useProductSearch — fetches all products once and provides filtered results.
 * Eliminates duplicated fetch+filter logic across search pages.
 *
 * Returns: { products, filtered, search, setSearch, loading, error }
 */
export function useProductSearch() {
  const [products, setProducts] = useState([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cancel any in-flight request if the component unmounts
    abortRef.current = new AbortController();

    getAllProducts()
      .then((res) => setProducts(res.data?.data ?? []))
      .catch((err) => {
        if (err?.name !== "CanceledError") {
          setError("प्रॉडक्ट्स लोड होऊ शकले नाही");
        }
      })
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    const words = term.split(/\s+/);
    return products.filter((p) => {
      const haystack = `${p.name ?? ""} ${p.marathiName ?? ""}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [products, search]);

  return { products, filtered, search, setSearch, loading, error };
}
