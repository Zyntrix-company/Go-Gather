export type LegalDocumentResponse = {
  documentType: string;
  version: string;
  effectiveAt: string;
  contentHtml: string;
  title: string;
};

function apiRoot(): string {
  const base = import.meta.env.VITE_API_URL || 'https://api.gatherrgo.com';
  return String(base).replace(/\/$/, '');
}

export async function fetchLegalDocument(type: 'privacy' | 'terms'): Promise<LegalDocumentResponse> {
  const res = await fetch(`${apiRoot()}/legal/${type}`);
  if (!res.ok) {
    throw new Error(`Failed to load ${type} (${res.status})`);
  }
  return res.json();
}
