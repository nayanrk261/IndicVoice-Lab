export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export const getApiUrl = (path) => {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
};
