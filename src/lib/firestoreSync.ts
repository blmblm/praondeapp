import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { EventItem, CidadeItem, CategoryItem } from '../types';

/**
 * Remove recursivamente todas as propriedades com valor `undefined`,
 * pois o Firestore rejeita estritamente campos com valor `undefined`.
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeForFirestore(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// ==================== EVENTOS ====================
const EVENTS_COLL = 'eventos';

export function subscribeToEvents(callback: (events: EventItem[]) => void) {
  try {
    const q = query(collection(db, EVENTS_COLL));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: EventItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            title: data.title || '',
            description: data.description || '',
            category: data.category || '',
            categoryId: data.categoryId ?? undefined,
            date: data.date || '',
            time: data.time || '',
            endDate: data.endDate || '',
            endTime: data.endTime || '',
            locationName: data.locationName || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            latitude: data.latitude !== undefined && data.latitude !== null ? String(data.latitude) : undefined,
            longitude: data.longitude !== undefined && data.longitude !== null ? String(data.longitude) : undefined,
            liberado: data.liberado !== undefined && data.liberado !== null && data.liberado !== '' ? data.liberado : 'N',
            isFree: Boolean(data.isFree),
            price: data.price !== undefined && data.price !== null ? Number(data.price) : undefined,
            priceDetails: data.priceDetails || '',
            imageUrl: data.imageUrl || '',
            mediaType: data.mediaType || (data.videoUrl ? 'video' : 'image'),
            videoUrl: data.videoUrl || undefined,
            url: data.url || data.videoUrl || data.imageUrl || undefined,
            organizer: data.organizer || '',
            contact: data.contact || '',
            tags: Array.isArray(data.tags) ? data.tags : typeof data.tags === 'string' ? JSON.parse(data.tags || '[]') : [],
            featured: Boolean(data.featured),
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (err) => {
        console.warn('[Firestore] Erro ao sincronizar eventos em tempo real:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Falha ao iniciar listener de eventos:', err);
    return () => {};
  }
}

export async function saveEventToFirestore(event: EventItem): Promise<void> {
  try {
    if (!event || !event.id) return;
    const eventRef = doc(db, EVENTS_COLL, event.id);

      // Firestore proíbe estritamente documentos maiores que 1MB.
      // Trunca strings base64 gigantes (mantidas integralmente na base SQLite local).
      let safeVideoUrl = event.videoUrl || null;
      if (safeVideoUrl && safeVideoUrl.length > 500000) {
        safeVideoUrl = '[video_local_sqlite]';
      }
      let safeUrl = event.url || event.videoUrl || event.imageUrl || null;
      if (safeUrl && safeUrl.length > 500000) {
        safeUrl = safeVideoUrl === '[video_local_sqlite]' ? '[video_local_sqlite]' : null;
      }
      let safeImageUrl = event.imageUrl || '';
      if (safeImageUrl && safeImageUrl.length > 500000) {
        safeImageUrl = '';
      }

      // Mapeamento explícito para garantir tipos compatíveis com Firestore (sem undefined)
      const rawData = {
        id: event.id,
        title: event.title || '',
        description: event.description || '',
        category: event.category || '',
        categoryId: event.categoryId !== undefined ? event.categoryId : null,
        date: event.date || '',
        time: event.time || '',
        endDate: event.endDate || '',
        endTime: event.endTime || '',
        locationName: event.locationName || '',
        address: event.address || '',
        city: event.city || '',
        state: event.state || '',
        latitude: event.latitude !== undefined && event.latitude !== null && String(event.latitude).trim() !== '' ? String(event.latitude) : null,
        longitude: event.longitude !== undefined && event.longitude !== null && String(event.longitude).trim() !== '' ? String(event.longitude) : null,
        liberado: event.liberado !== undefined && event.liberado !== null && event.liberado !== '' ? event.liberado : 'N',
        status: event.status || 'em_analise',
        isFree: Boolean(event.isFree),
        price: event.price !== undefined && event.price !== null ? Number(event.price) : null,
        priceDetails: event.priceDetails || '',
        imageUrl: safeImageUrl,
        mediaType: event.mediaType || (event.videoUrl ? 'video' : 'image'),
        videoUrl: safeVideoUrl,
        url: safeUrl,
        organizer: event.organizer || '',
        contact: event.contact || '',
        tags: Array.isArray(event.tags) ? event.tags : [],
        featured: Boolean(event.featured),
        createdAt: event.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

    const cleanData = sanitizeForFirestore(rawData);
    await setDoc(eventRef, cleanData, { merge: true });
  } catch (err) {
    console.error('[Firestore] Erro ao salvar evento no Firestore:', err);
  }
}

export async function deleteEventFromFirestore(id: string): Promise<void> {
  try {
    if (!id) return;
    await deleteDoc(doc(db, EVENTS_COLL, id));
  } catch (err) {
    console.error('[Firestore] Erro ao remover evento do Firestore:', err);
  }
}

export async function updateEventLiberadoInFirestore(id: string, liberado: 'S' | 'N'): Promise<void> {
  try {
    if (!id) return;
    const eventRef = doc(db, EVENTS_COLL, id);
    // Usamos setDoc com { merge: true } em vez de updateDoc.
    // O updateDoc gera "No document to update" caso o documento ainda não exista no Firestore.
    // O setDoc com merge: true cria ou atualiza sem erro.
    await setDoc(eventRef, { liberado, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('[Firestore] Erro ao atualizar status liberado no Firestore:', err);
  }
}

// ==================== ESTADO / CIDADES ====================
const ESTADO_COLL = 'estado';

export function subscribeToEstados(callback: (estados: CidadeItem[]) => void) {
  try {
    const q = query(collection(db, ESTADO_COLL));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: CidadeItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const numericId = Number(d.id);
          list.push({
            id: isNaN(numericId) ? 1 : numericId,
            nome: data.nome || '',
            estado: data.estado || '',
            regiao: data.regiao || 'Sudeste',
            ativa: Boolean(data.ativa),
            criadoEm: data.criado_em || data.criadoEm || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (err) => {
        console.warn('[Firestore] Erro ao sincronizar estados:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Falha ao iniciar listener de estados:', err);
    return () => {};
  }
}

export async function saveEstadoToFirestore(estadoItem: CidadeItem): Promise<void> {
  try {
    if (!estadoItem || !estadoItem.id) return;
    const docId = String(estadoItem.id);
    const cleanData = sanitizeForFirestore({
      id: estadoItem.id,
      nome: estadoItem.nome || '',
      estado: estadoItem.estado || '',
      regiao: estadoItem.regiao || 'Sudeste',
      ativa: Boolean(estadoItem.ativa),
      criadoEm: estadoItem.criadoEm || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, ESTADO_COLL, docId), cleanData, { merge: true });
  } catch (err) {
    console.error('[Firestore] Erro ao salvar estado no Firestore:', err);
  }
}

export async function deleteEstadoFromFirestore(id: string | number): Promise<void> {
  try {
    if (!id) return;
    await deleteDoc(doc(db, ESTADO_COLL, String(id)));
  } catch (err) {
    console.error('[Firestore] Erro ao deletar estado do Firestore:', err);
  }
}

export async function deleteAllEstadosFromFirestore(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, ESTADO_COLL));
    const batch = writeBatch(db);
    snapshot.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (err) {
    console.error('[Firestore] Erro ao excluir todos os estados do Firestore:', err);
  }
}

// ==================== CATEGORIAS ====================
const CATEGORIAS_COLL = 'categorias';

export function subscribeToCategorias(callback: (categorias: CategoryItem[]) => void) {
  try {
    const q = query(collection(db, CATEGORIAS_COLL));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: CategoryItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const numericId = Number(d.id);
          list.push({
            id: isNaN(numericId) ? 1 : numericId,
            nome: data.nome || '',
            descricao: data.descricao || '',
            ativa: Boolean(data.ativa),
            criadoEm: data.criado_em || data.criadoEm || new Date().toISOString(),
          });
        });
        callback(list);
      },
      (err) => {
        console.warn('[Firestore] Erro ao sincronizar categorias:', err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] Falha ao iniciar listener de categorias:', err);
    return () => {};
  }
}

export async function saveCategoriaToFirestore(categoria: CategoryItem): Promise<void> {
  try {
    if (!categoria || !categoria.id) return;
    const docId = String(categoria.id);
    const cleanData = sanitizeForFirestore({
      id: categoria.id,
      nome: categoria.nome || '',
      descricao: categoria.descricao || '',
      ativa: Boolean(categoria.ativa),
      criadoEm: categoria.criadoEm || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, CATEGORIAS_COLL, docId), cleanData, { merge: true });
  } catch (err) {
    console.error('[Firestore] Erro ao salvar categoria no Firestore:', err);
  }
}

export async function deleteCategoriaFromFirestore(id: string | number): Promise<void> {
  try {
    if (!id) return;
    await deleteDoc(doc(db, CATEGORIAS_COLL, String(id)));
  } catch (err) {
    console.error('[Firestore] Erro ao deletar categoria no Firestore:', err);
  }
}
