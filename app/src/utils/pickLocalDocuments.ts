import { pick as pickDocument, types as docTypes, keepLocalCopy, isErrorWithCode, errorCodes } from '@react-native-documents/picker';

export type PickedLocalDoc = { uri: string; name: string; type: string };

let pickInFlight = false;

/**
 * Opens the system document picker (multi-select) and copies every picked file
 * into the app cache so it can be uploaded later. Resolves to [] when the user
 * cancels, or when a picker is already open (a double tap must not surface the
 * native "previous promise did not settle" error). Files that fail to copy are
 * skipped; throws only when the picker itself could not be opened.
 */
export async function pickLocalDocuments(): Promise<PickedLocalDoc[]> {
  if (pickInFlight) return [];
  pickInFlight = true;
  try {
    const picked = await pickDocument({ type: [docTypes.allFiles], allowMultiSelection: true });
    if (!picked.length) return [];
    const named = picked.map((p, i) => ({
      source: p,
      fileName: p.name ?? `file_${Date.now()}_${i}`,
    }));
    const copies = await keepLocalCopy({
      files: named.map((n) => ({ uri: n.source.uri, fileName: n.fileName })) as [
        { uri: string; fileName: string },
        ...{ uri: string; fileName: string }[],
      ],
      destination: 'cachesDirectory',
    });
    const docs: PickedLocalDoc[] = [];
    named.forEach((n, i) => {
      const copy = copies.find((c) => c.sourceUri === n.source.uri) ?? copies[i];
      if (copy?.status !== 'success') return;
      docs.push({ uri: copy.localUri, name: n.fileName, type: n.source.type ?? 'application/octet-stream' });
    });
    return docs;
  } catch (err) {
    if (isErrorWithCode(err) && (err.code === errorCodes.OPERATION_CANCELED || err.code === errorCodes.IN_PROGRESS)) return [];
    throw err;
  } finally {
    pickInFlight = false;
  }
}
