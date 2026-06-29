const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Use relative URLs in development to route requests through the Next.js config rewrites proxy.
  // This bypasses network firewall blocks on port 3001 when testing from a mobile phone.
  return '';
};

export const API_URL = getApiUrl();
