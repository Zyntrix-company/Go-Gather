import axios from 'axios';
import { API_BASE } from './client';
import client from './client';

export type LegalDocumentResponse = {
  documentType: string;
  version: string;
  effectiveAt: string;
  contentHtml: string;
  title: string;
};

/** Public GET — no auth required */
export async function fetchLegalDocument(type: 'privacy' | 'terms'): Promise<LegalDocumentResponse> {
  const { data } = await axios.get<LegalDocumentResponse>(`${API_BASE}/legal/${type}`, {
    timeout: 25000,
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

export type LegalStatusResponse = {
  privacy: {
    currentVersion: string | null;
    acknowledgedVersion: string | null;
    needsAck: boolean;
    effectiveAt: string | null;
  };
  terms: {
    currentVersion: string | null;
    acknowledgedVersion: string | null;
    needsAck: boolean;
    effectiveAt: string | null;
  };
};

export async function fetchLegalStatus(): Promise<LegalStatusResponse> {
  const { data } = await client.get<LegalStatusResponse>('/users/legal-status');
  return data;
}

export async function postLegalAck(body: {
  privacyVersion?: string;
  termsVersion?: string;
}): Promise<LegalStatusResponse> {
  const { data } = await client.post<LegalStatusResponse>('/users/legal-ack', body);
  return data;
}
