/**
 * Modelo de Nota
 * Interfaz TypeScript que representa una anotación del usuario
 */

export type NoteMode = 'text' | 'ink';

export interface Note {
  _id: string;
  documentId: string;
  pageIndex: number;
  mode: NoteMode;
  anchors: Anchor[];
  text?: string; // Opcional: solo para mode === 'text'
  ink?: InkData; // Opcional: solo para mode === 'ink'
  tags: string[];
  color: string;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
  preview?: string; // Virtual field del backend
}

export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export interface InkData {
  svgPath?: string; // Path SVG escalable
  strokes: Stroke[]; // Trazos crudos para edición
  pngPath?: string; // Opcional: rasterizado para export
}

export interface Stroke {
  points: Point[];
  width: number;
  color: string;
}

export interface Point {
  x: number;
  y: number;
  t?: number; // timestamp opcional
}

/**
 * DTO para crear una nota
 */
export interface CreateNoteDto {
  documentId: string;
  pageIndex: number;
  mode: NoteMode;
  anchors?: Anchor[];
  text?: string; // Requerido si mode === 'text'
  ink?: InkData; // Requerido si mode === 'ink'
  tags?: string[];
  color?: string;
}

/**
 * DTO para actualizar una nota
 */
export interface UpdateNoteDto {
  mode?: NoteMode;
  text?: string;
  ink?: InkData;
  anchors?: Anchor[];
  tags?: string[];
  color?: string;
  isFavorite?: boolean;
  pageIndex?: number;
}

/**
 * Respuesta de la API para notas
 */
export interface NotesResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  pages: number;
  data: Note[];
}

export interface NoteResponse {
  success: boolean;
  message?: string;
  data: Note;
}

/**
 * Parámetros de filtro para búsqueda de notas
 */
export interface NoteFilters {
  documentId?: string;
  pageIndex?: number;
  tags?: string;
  search?: string;
  page?: number;
  limit?: number;
}
