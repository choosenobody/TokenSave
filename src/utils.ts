// @ts-nocheck
// Extracted from src/main.ts — pure synchronous formatting/string helpers only.
// No logic changed.  Bodies are mechanical copies of the original functions.

export function stringify(value) {
  return value == null ? "" : String(value);
}

export function normalizeKey(value) {
  return stringify(value).trim().toLowerCase();
}

export function slugify(value) {
  return stringify(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cleanFileStem(fileName) {
  return stringify(fileName).split(/[\\/]/).pop().replace(/\.(jsonl|json|zip)$/i, "");
}

export function escapeHtml(value) {
  return stringify(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatInteger(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 3 : 2,
    maximumFractionDigits: value < 1 ? 3 : 2
  }).format(value || 0);
}

export function formatPercent(value) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return stringify(value || "unknown");
  }
  return date.toLocaleString();
}

export function formatShortDuration(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  if (minutes % 1440 === 0) {
    return `${Math.round(minutes / 1440)}d`;
  }
  if (minutes % 60 === 0) {
    return `${Math.round(minutes / 60)}h`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}h ${remainder}m`;
}
