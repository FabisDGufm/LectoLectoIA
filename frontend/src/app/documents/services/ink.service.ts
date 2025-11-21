/**
 * Servicio de Tinta (Ink)
 * Maneja el dibujo a mano sobre canvas usando Pointer Events
 */

import { Injectable, signal } from '@angular/core';
import { Stroke, Point, InkData } from '../models/note.model';

@Injectable({
  providedIn: 'root'
})
export class InkService {
  // Estado actual del dibujo
  private currentStroke = signal<Point[]>([]);
  private allStrokes = signal<Stroke[]>([]);
  private isDrawing = signal<boolean>(false);

  // Configuración del pincel
  private brushWidth = signal<number>(2);
  private brushColor = signal<string>('#000000');

  /**
   * Obtiene todos los trazos actuales
   */
  getStrokes() {
    return this.allStrokes.asReadonly();
  }

  /**
   * Obtiene el estado de dibujo
   */
  getIsDrawing() {
    return this.isDrawing.asReadonly();
  }

  /**
   * Inicia un nuevo trazo
   */
  startStroke(x: number, y: number): void {
    this.isDrawing.set(true);
    this.currentStroke.set([{ x, y, t: Date.now() }]);
  }

  /**
   * Agrega un punto al trazo actual
   */
  addPoint(x: number, y: number): void {
    if (!this.isDrawing()) return;

    const points = this.currentStroke();
    this.currentStroke.set([...points, { x, y, t: Date.now() }]);
  }

  /**
   * Finaliza el trazo actual y lo agrega a la colección
   */
  endStroke(): void {
    if (!this.isDrawing()) return;

    const points = this.currentStroke();

    if (points.length > 1) {
      const newStroke: Stroke = {
        points,
        width: this.brushWidth(),
        color: this.brushColor()
      };

      this.allStrokes.set([...this.allStrokes(), newStroke]);
    }

    this.currentStroke.set([]);
    this.isDrawing.set(false);
  }

  /**
   * Dibuja todos los trazos en un canvas
   */
  drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (const stroke of strokes) {
      this.drawStroke(ctx, stroke);
    }

    // Dibujar trazo actual (mientras se dibuja)
    if (this.isDrawing()) {
      const currentPoints = this.currentStroke();
      if (currentPoints.length > 1) {
        const currentStroke: Stroke = {
          points: currentPoints,
          width: this.brushWidth(),
          color: this.brushColor()
        };
        this.drawStroke(ctx, currentStroke);
      }
    }
  }

  /**
   * Dibuja un trazo específico
   */
  private drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    if (stroke.points.length < 2) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
  }

  /**
   * Convierte los trazos a InkData para guardar
   */
  toInkData(): InkData {
    const strokes = this.allStrokes();
    const svgPath = this.strokesToSvgPath(strokes);

    return {
      svgPath,
      strokes
    };
  }

  /**
   * Carga trazos desde InkData
   */
  loadInkData(inkData: InkData | null): void {
    if (!inkData || !inkData.strokes) {
      this.clear();
      return;
    }

    this.allStrokes.set(inkData.strokes);
  }

  /**
   * Limpia todos los trazos
   */
  clear(): void {
    this.allStrokes.set([]);
    this.currentStroke.set([]);
    this.isDrawing.set(false);
  }

  /**
   * Deshace el último trazo
   */
  undo(): void {
    const strokes = this.allStrokes();
    if (strokes.length > 0) {
      this.allStrokes.set(strokes.slice(0, -1));
    }
  }

  /**
   * Configura el ancho del pincel
   */
  setBrushWidth(width: number): void {
    this.brushWidth.set(Math.max(0.5, Math.min(20, width)));
  }

  /**
   * Configura el color del pincel
   */
  setBrushColor(color: string): void {
    this.brushColor.set(color);
  }

  /**
   * Obtiene el ancho actual del pincel
   */
  getBrushWidth() {
    return this.brushWidth.asReadonly();
  }

  /**
   * Obtiene el color actual del pincel
   */
  getBrushColor() {
    return this.brushColor.asReadonly();
  }

  /**
   * Convierte los trazos a un path SVG
   * Formato: "M x,y L x,y L x,y ... M x,y L x,y ..."
   */
  private strokesToSvgPath(strokes: Stroke[]): string {
    let svgPath = '';

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;

      const firstPoint = stroke.points[0];
      svgPath += `M${firstPoint.x},${firstPoint.y}`;

      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        svgPath += ` L${point.x},${point.y}`;
      }

      svgPath += ' ';
    }

    return svgPath.trim();
  }

  /**
   * Suaviza los trazos usando interpolación (opcional, para mejorar calidad)
   */
  smoothStroke(points: Point[], smoothing: number = 0.3): Point[] {
    if (points.length < 3) return points;

    const smoothed: Point[] = [points[0]];

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const smoothedX = curr.x * (1 - smoothing) + (prev.x + next.x) * smoothing / 2;
      const smoothedY = curr.y * (1 - smoothing) + (prev.y + next.y) * smoothing / 2;

      smoothed.push({ x: smoothedX, y: smoothedY, t: curr.t });
    }

    smoothed.push(points[points.length - 1]);

    return smoothed;
  }

  /**
   * Exporta los trazos como imagen PNG (para usar en exportación)
   */
  exportAsPng(canvas: HTMLCanvasElement): string | null {
    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error al exportar canvas como PNG:', error);
      return null;
    }
  }
}
