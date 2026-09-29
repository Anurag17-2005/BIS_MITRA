const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const FILES = import.meta.env.VITE_FILES_URL || 'http://localhost:4000/files';

export { API, FILES };

export async function searchStandards(q) {
  const res = await fetch(`${API}/api/standards?q=${encodeURIComponent(q)}`);
  return res.json();
}

export async function getStandard(isNumber) {
  const res = await fetch(`${API}/api/standards?is_number=${encodeURIComponent(isNumber)}`);
  return res.json();
}

export async function getReferredStandards(isNumber) {
  const res = await fetch(`${API}/api/standards/${encodeURIComponent(isNumber)}/referred`);
  return res.json();
}
