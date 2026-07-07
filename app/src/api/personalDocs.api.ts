/**
 * Personal Documents API — user-scoped docs (parentType 'user' on the backend).
 * Mirrors the trip/event docs endpoints but under /users/me/docs. Capped at 10.
 */
import client, { API_BASE } from './client';
import storage from '../utils/storage';
import useAuthStore from '../store/authStore';
import type { Doc, EmailProvider, EmailAttachment, DriveFile } from './trips.api';

type ImportResult = {
  imported: { docId: string; fileName: string; fileUrl: string }[];
  failed: { fileName: string; reason: string }[];
};

export const MAX_PERSONAL_DOCS = 10;

export type { Doc };

type UploadAsset = { uri: string; type?: string; name?: string };

/** XHR multipart upload supporting POST (upload) and PUT (replace). */
function uploadMultipart(method: 'POST' | 'PUT', path: string, formData: FormData): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let token = await storage.getToken();
    if (!token) token = useAuthStore.getState().accessToken;

    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 60000;
    xhr.onload = () => {
      let json: any;
      try { json = JSON.parse(xhr.responseText); } catch { json = { message: xhr.responseText }; }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json);
      } else {
        reject(Object.assign(new Error(json?.message ?? 'Upload failed'), { response: { status: xhr.status, data: json } }));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(formData);
  });
}

function fileFormData(asset: UploadAsset): FormData {
  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    type: asset.type ?? 'application/octet-stream',
    name: asset.name ?? 'document',
  } as any);
  return formData;
}

export async function getPersonalDocs() {
  const res = await client.get('/users/me/docs');
  return res.data as { docs: Doc[]; total: number; maxCount: number };
}

export async function uploadPersonalDoc(asset: UploadAsset) {
  return uploadMultipart('POST', '/users/me/docs', fileFormData(asset)) as Promise<{ doc: Doc }>;
}

export async function replacePersonalDoc(docId: string, asset: UploadAsset) {
  return uploadMultipart('PUT', `/users/me/docs/${docId}`, fileFormData(asset)) as Promise<{ doc: Doc }>;
}

export async function renamePersonalDoc(docId: string, newName: string) {
  const res = await client.patch(`/users/me/docs/${docId}`, { fileName: newName });
  return res.data as { doc: Doc };
}

export async function deletePersonalDoc(docId: string) {
  const res = await client.delete(`/users/me/docs/${docId}`);
  return res.data as { success: boolean };
}

// ─── Email / Drive import into personal docs (parentType 'user') ────────────────

export async function importEmailAttachmentsToPersonal(
  provider: EmailProvider,
  attachments: Pick<EmailAttachment, 'attachmentId' | 'messageId' | 'fileName'>[],
) {
  const res = await client.post('/email-docs/import', {
    parentType: 'user',
    attachments: attachments.map((a) => ({ ...a, provider })),
  });
  return res.data as ImportResult;
}

export async function importDriveFilesToPersonal(
  files: Pick<DriveFile, 'fileId' | 'name' | 'mimeType'>[],
) {
  const res = await client.post('/drive-docs/import', { parentType: 'user', files });
  return res.data as ImportResult;
}
