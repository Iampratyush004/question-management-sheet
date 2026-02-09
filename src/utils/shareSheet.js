const toBase64Url = (value) =>
  value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (value) => {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base.length % 4 === 0 ? '' : '='.repeat(4 - (base.length % 4));
  return `${base}${pad}`;
};

export const encodeSheetToShareToken = (sheet) => {
  const json = JSON.stringify(sheet);
  const bytes = new TextEncoder().encode(json);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return toBase64Url(btoa(binary));
};

export const decodeShareTokenToSheet = (token) => {
  const binary = atob(fromBase64Url(token));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
};
