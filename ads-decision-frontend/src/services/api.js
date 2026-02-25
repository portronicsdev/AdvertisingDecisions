import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const instance = axios.create({
  baseURL: BASE_URL
});

// Optional logging (like your backend logger 😄)
instance.interceptors.response.use(
  (response) => {
    console.log(
      `[API] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`
    );
    return response;
  },
  (error) => {
    console.error('[API ERROR]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const api = {
  get: (url, params) => instance.get(url, { params }),
  post: (url, data, config = {}) => instance.post(url, data, config)
};
