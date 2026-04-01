/**
 * Extracts a human-readable message from any thrown Axios error.
 * Handles: network errors, express-validator arrays, backend envelope, HTTP codes.
 */
export function extractError(err, fallback = "काहीतरी चूक झाली. पुन्हा प्रयत्न करा.") {
  if (!err) return fallback;

  if (err.code === "ERR_NETWORK" || !err.response) {
    return "नेटवर्क त्रुटी — इंटरनेट कनेक्शन तपासा.";
  }

  const { data, status } = err.response ?? {};

  // express-validator array
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.msg ?? e.message).filter(Boolean).join(", ");
  }

  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.error   === "string" && data.error)   return data.error;

  if (status === 400) return "चुकीचा डेटा — कृपया पुन्हा तपासा.";
  if (status === 401) return "सत्र संपले. पुन्हा लॉगिन करा.";
  if (status === 403) return "परवानगी नाही.";
  if (status === 404) return "माहिती सापडली नाही.";
  if (status >= 500)  return "सर्व्हर त्रुटी — नंतर पुन्हा प्रयत्न करा.";

  return fallback;
}
