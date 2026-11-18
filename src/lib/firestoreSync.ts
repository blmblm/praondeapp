import { EventItem, CidadeItem, CategoryItem } from '../types';

/**
 * Cloud SQL PostgreSQL (/api/*) é a única fonte oficial de verdade.
 * Os helpers abaixo são mantidos como no-op compatíveis para evitar consumo
 * de cota no Firestore ou dessincronização entre dispositivos.
 */

export function subscribeToEvents(_callback: (events: EventItem[]) => void) {
  return () => {};
}

export async function saveEventToFirestore(_event: EventItem): Promise<void> {
  return;
}

export async function deleteEventFromFirestore(_id: string): Promise<void> {
  return;
}

export async function updateEventLiberadoInFirestore(_id: string, _liberado: 'S' | 'N'): Promise<void> {
  return;
}

export function subscribeToEstados(_callback: (estados: CidadeItem[]) => void) {
  return () => {};
}

export async function saveEstadoToFirestore(_estadoItem: CidadeItem): Promise<void> {
  return;
}

export async function deleteEstadoFromFirestore(_id: string | number): Promise<void> {
  return;
}

export async function deleteAllEstadosFromFirestore(): Promise<void> {
  return;
}

export function subscribeToCategorias(_callback: (categorias: CategoryItem[]) => void) {
  return () => {};
}

export async function saveCategoriaToFirestore(_categoria: CategoryItem): Promise<void> {
  return;
}

export async function deleteCategoriaFromFirestore(_id: string | number): Promise<void> {
  return;
}

export function subscribeToPalavrasIgnoradas(_callback: (words: { id: number; palavra: string }[]) => void) {
  return () => {};
}

export async function savePalavraIgnoradaToFirestore(_wordItem: { id: number; palavra: string }): Promise<void> {
  return;
}

export async function deletePalavraIgnoradaFromFirestore(_id: string | number): Promise<void> {
  return;
}

export function subscribeToAdvertisers(_callback: (advertisers: any[]) => void) {
  return () => {};
}

export async function saveAdvertiserToFirestore(_advertiser: any): Promise<void> {
  return;
}
