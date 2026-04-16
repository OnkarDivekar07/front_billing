/**
 * All API calls in one place.
 * Backend base: REACT_APP_API_URL (must include /api)
 *
 * Every response is wrapped in: { success, message, data: <payload>, meta }
 * Unwrap with: res.data.data
 */

import API from "./client";

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Backend route: POST /user/login  (not /user/login-password)
export const loginWithPassword = (email, password) =>
  API.post("/user/login", { email, password });

// ─── Products ─────────────────────────────────────────────────────────────────
export const getAllProducts = () =>
  API.get("/products/getproduct");

export const getProductById = (id) =>
  API.get(`/products/${id}`);

export const addStock = (payload) =>
  API.post("/products/add-stock", payload);

// ─── Transactions ──────────────────────────────────────────────────────────────
// Backend route: POST /transactions/billing  (not /billingTranction)
export const submitBilling = (payload) =>
  API.post("/transactions/billing", payload);

// Backend route: GET /transactions/daily  (not /dailyalltranction)
export const getDailyTransactions = (date) =>
  API.get("/transactions/daily", { params: date ? { date } : {} });

// Backend route: PATCH /transactions/rollback/:id  (not POST)
export const rollbackTransaction = (id) =>
  API.patch(`/transactions/rollback/${id}`);

// ─── Reorder ──────────────────────────────────────────────────────────────────
// Backend route: GET /reorder/suggestions  (not /suggested-order-quantity)
export const getReorderSuggestions = () =>
  API.get("/reorder/suggestions");

// ─── Missing Items ─────────────────────────────────────────────────────────────
// Backend routes: /missing-items
export const getMissingItems = () =>
  API.get("/missing-items");

export const createMissingItem = (name) =>
  API.post("/missing-items", { name });

// PUT /missing-items/:id — update requestCount (used to increment)
export const incrementMissingItem = (id, requestCount) =>
  API.put(`/missing-items/${id}`, { requestCount });

export const deleteMissingItem = (id) =>
  API.delete(`/missing-items/${id}`);

// ─── Suppliers ─────────────────────────────────────────────────────────────────
// Backend route: GET /suppliers
export const getSuppliers = () =>
  API.get("/suppliers");

// ─── Expenses ──────────────────────────────────────────────────────────────────
// Backend routes: /expenses
export const getExpenses = (params = {}) =>
  API.get("/expenses", { params });

// GET /expenses/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getExpenseSummary = (params = {}) =>
  API.get("/expenses/summary", { params });

export const createExpense = (payload) =>
  API.post("/expenses", payload);

export const updateExpense = (id, payload) =>
  API.put(`/expenses/${id}`, payload);

export const deleteExpense = (id) =>
  API.delete(`/expenses/${id}`);

// ─── Finance / Balance Sheet ────────────────────────────────────────────────────
// GET /finance/balance-sheet?range=today|week|month|year|YYYY-MM-DD..YYYY-MM-DD
export const getBalanceSheet = (range) =>
  API.get("/finance/balance-sheet", { params: range ? { range } : {} });
