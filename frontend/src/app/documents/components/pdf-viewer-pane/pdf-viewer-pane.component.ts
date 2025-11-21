import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';
import { NotebookService, NotebookPage } from '../../services/notebook.service';
import { DocumentsService } from '../../services/documents.service';
import { NotesService } from '../../services/notes.service';
import { Subject, debounceTime } from 'rxjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'select' | 'none';

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  tool: DrawingTool;
}

interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
}

interface RenderedPage {
  pageId: string;
  documentId?: string;
  documentTitle?: string;
  pageNumber?: number;
  type: 'pdf' | 'blank';
  order: number;
  canvas: HTMLCanvasElement;
  annotationCanvas?: HTMLCanvasElement;
  strokes: Stroke[];
  textBoxes: TextBox[];
  thumbnail?: HTMLCanvasElement;
}

@Component({
  selector: 'app-pdf-viewer-pane',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-viewer-pane.component.html',
  styleUrls: ['./pdf-viewer-pane.component.scss']
})
export class PdfViewerPaneComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly notebookService = inject(NotebookService);
  private readonly documentsService = inject(DocumentsService);
  private readonly notesService = inject(NotesService);

  // Auto-save subject
  private saveAnnotations$ = new Subject<{ pageIndex: number; documentId?: string }>();

  @ViewChild('pagesContainer', { static: false }) pagesContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('thumbnailsContainer', { static: false }) thumbnailsContainerRef!: ElementRef<HTMLDivElement>;

  scale = signal(1.0);
  viewScale = signal(1.0);
  isLoading = signal(false);
  error = signal<string | null>(null);
  renderedPages = signal<RenderedPage[]>([]);
  totalPagesAll = signal(0);
  showThumbnails = signal(false);
  bookMode = signal(false);

  // Drawing tools
  currentTool = signal<DrawingTool>('none');
  penColor = signal('#000000');
  penWidth = signal(2);
  highlighterColor = signal('#ffff00');
  highlighterWidth = signal(20);
  eraserWidth = signal(20);

  private loadedPdfs: Map<string, pdfjsLib.PDFDocumentProxy> = new Map();
  private isDestroyed = false;

  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;
  private lastTouchDistance = 0;
  private initialPinchScale = 1;

  // Drawing state
  private isDrawing = false;
  private currentStroke: Stroke | null = null;
  private activeAnnotationCanvas: HTMLCanvasElement | null = null;
  private activePageIndex: number = -1;

  pages = this.notebookService.pages;
  hasPages = this.notebookService.hasPages;

  constructor() {
    effect(() => {
      const notebookPages = this.pages();
      if (notebookPages.length > 0 && !this.isDestroyed) {
        this.loadNotebookPages(notebookPages);
      }
    });

    // Setup auto-save with debounce
    this.saveAnnotations$.pipe(
      debounceTime(1000) // Wait 1 second after last change
    ).subscribe(({ pageIndex, documentId }) => {
      this.savePageAnnotations(pageIndex, documentId);
    });
  }

  ngOnInit(): void {
    this.notebookService.loadActiveNotebook().subscribe({
      error: (err) => console.error('Error cargando notebook:', err)
    });
  }

  ngAfterViewInit(): void {
    this.setupZoomAndPan();
  }

  private setupZoomAndPan(): void {
    setTimeout(() => this.attachZoomListeners(), 500);
  }

  private attachZoomListeners(): void {
    const container = this.pagesContainerRef?.nativeElement;
    if (!container) {
      setTimeout(() => this.attachZoomListeners(), 200);
      return;
    }

    container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    container.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    container.addEventListener('touchend', this.handleTouchEnd.bind(this));
  }

  private handleWheel(e: WheelEvent): void {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.min(3.0, Math.max(0.3, this.viewScale() + delta));
      this.viewScale.set(Math.round(newScale * 100) / 100);
      this.applyViewScale();
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    const container = this.pagesContainerRef?.nativeElement;
    if (!container) return;

    // Don't pan if drawing tool is active and clicking on canvas
    const tool = this.currentTool();
    if (tool !== 'none' && tool !== 'select') {
      const target = e.target as HTMLElement;
      if (target.classList.contains('annotation-canvas')) {
        return; // Let the annotation canvas handle it
      }
    }

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this.isPanning = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.scrollLeft = container.scrollLeft;
      this.scrollTop = container.scrollTop;
      container.style.cursor = 'grabbing';
      e.preventDefault();
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;
    const container = this.pagesContainerRef?.nativeElement;
    if (!container) return;
    e.preventDefault();
    const walkX = e.clientX - this.startX;
    const walkY = e.clientY - this.startY;
    container.scrollLeft = this.scrollLeft - walkX;
    container.scrollTop = this.scrollTop - walkY;
  }

  private handleMouseUp(): void {
    const container = this.pagesContainerRef?.nativeElement;
    if (container) container.style.cursor = 'default';
    this.isPanning = false;
  }

  private handleTouchStart(e: TouchEvent): void {
    const container = this.pagesContainerRef?.nativeElement;
    if (!container) return;

    // Don't pan if drawing tool is active and touching canvas
    const tool = this.currentTool();
    if (tool !== 'none' && tool !== 'select' && e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (target.classList.contains('annotation-canvas')) {
        return; // Let the annotation canvas handle it
      }
    }

    if (e.touches.length === 2) {
      e.preventDefault();
      this.lastTouchDistance = this.getTouchDistance(e.touches);
      this.initialPinchScale = this.viewScale();
      this.isPanning = false;
    } else if (e.touches.length === 1) {
      this.isPanning = true;
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
      this.scrollLeft = container.scrollLeft;
      this.scrollTop = container.scrollTop;
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    const container = this.pagesContainerRef?.nativeElement;
    if (!container) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = this.getTouchDistance(e.touches);
      if (this.lastTouchDistance > 0) {
        const scaleFactor = currentDistance / this.lastTouchDistance;
        const newScale = Math.min(3.0, Math.max(0.3, this.initialPinchScale * scaleFactor));
        this.viewScale.set(Math.round(newScale * 100) / 100);
        this.applyViewScale();
      }
    } else if (e.touches.length === 1 && this.isPanning) {
      e.preventDefault();
      const walkX = e.touches[0].clientX - this.startX;
      const walkY = e.touches[0].clientY - this.startY;
      container.scrollLeft = this.scrollLeft - walkX;
      container.scrollTop = this.scrollTop - walkY;
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) {
      this.isPanning = false;
      this.lastTouchDistance = 0;
    }
  }

  private getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private applyViewScale(): void {
    const container = this.pagesContainerRef?.nativeElement;
    if (!container) return;

    const scale = this.viewScale();

    // Escalar todos los canvas (tanto PDF como anotaciones)
    const canvases = container.querySelectorAll('canvas');
    canvases.forEach((canvas: HTMLCanvasElement) => {
      const originalWidth = canvas.width / (window.devicePixelRatio || 1);
      const originalHeight = canvas.height / (window.devicePixelRatio || 1);
      canvas.style.width = Math.floor(originalWidth * scale) + 'px';
      canvas.style.height = Math.floor(originalHeight * scale) + 'px';
    });

    // Escalar gap del contenedor principal entre spreads/páginas
    const zoomContent = container.querySelector('.zoom-content') as HTMLElement;
    if (zoomContent) {
      zoomContent.style.gap = Math.floor(24 * scale) + 'px';
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.loadedPdfs.forEach(pdf => pdf.destroy());
    this.loadedPdfs.clear();
  }

  async loadNotebookPages(notebookPages: NotebookPage[]): Promise<void> {
    if (notebookPages.length === 0) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.renderedPages.set([]);

    try {
      const allPages: RenderedPage[] = [];

      for (const page of notebookPages) {
        if (page.type === 'pdf' && page.documentId && page.pageNumber) {
          const docId = page.documentId._id;
          let pdfDoc = this.loadedPdfs.get(docId);

          if (!pdfDoc) {
            const pdfUrl = this.documentsService.getDocumentFileUrl(docId);
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            pdfDoc = await loadingTask.promise;
            this.loadedPdfs.set(docId, pdfDoc);
          }

          const canvas = await this.renderPageToCanvas(pdfDoc, page.pageNumber);
          const thumbnail = await this.renderThumbnail(pdfDoc, page.pageNumber);

          allPages.push({
            pageId: page._id,
            documentId: docId,
            documentTitle: page.documentId.title,
            pageNumber: page.pageNumber,
            type: 'pdf',
            order: page.order,
            canvas,
            thumbnail,
            strokes: [],
            textBoxes: []
          });
        } else if (page.type === 'blank') {
          const canvas = this.createBlankCanvas();
          const thumbnail = this.createBlankThumbnail();

          allPages.push({
            pageId: page._id,
            type: 'blank',
            order: page.order,
            canvas,
            thumbnail,
            strokes: [],
            textBoxes: []
          });
        }
      }

      this.totalPagesAll.set(allPages.length);
      this.renderedPages.set(allPages);
      this.isLoading.set(false);

      this.cdr.detectChanges();

      this.insertCanvasesToDom();
      this.insertThumbnailsToDom();

      // Load existing annotations for each PDF page
      allPages.forEach((page, index) => {
        if (page.type === 'pdf' && page.documentId) {
          this.loadAnnotationsForPage(page.documentId, index, page);
        }
      });

    } catch (err: any) {
      console.error('Error cargando páginas:', err);
      this.error.set(err.message || 'Error al cargar las páginas');
      this.isLoading.set(false);
    }
  }

  private createBlankCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const width = 595;
    const height = 842;
    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * this.scale() * outputScale);
    canvas.height = Math.floor(height * this.scale() * outputScale);
    canvas.style.width = Math.floor(width * this.scale()) + 'px';
    canvas.style.height = Math.floor(height * this.scale()) + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(outputScale, outputScale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width * this.scale(), height * this.scale());

    return canvas;
  }

  private createBlankThumbnail(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const width = 119;
    const height = 168;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    return canvas;
  }

  private async renderPageToCanvas(pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<HTMLCanvasElement> {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale() });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const transform = outputScale !== 1
      ? [outputScale, 0, 0, outputScale, 0, 0]
      : undefined;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      transform: transform
    };

    await page.render(renderContext).promise;

    return canvas;
  }

  private async renderThumbnail(pdfDoc: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<HTMLCanvasElement> {
    const page = await pdfDoc.getPage(pageNum);
    const thumbnailScale = 0.2;
    const viewport = page.getViewport({ scale: thumbnailScale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    return canvas;
  }

  private insertCanvasesToDom(): void {
    if (!this.pagesContainerRef?.nativeElement) return;

    const container = this.pagesContainerRef.nativeElement;
    container.innerHTML = '';

    const zoomContent = document.createElement('div');
    zoomContent.className = 'zoom-content';
    zoomContent.style.display = 'flex';
    zoomContent.style.flexDirection = 'column';
    zoomContent.style.alignItems = 'center';
    zoomContent.style.gap = '1.5rem';
    zoomContent.style.padding = '2rem 4rem';

    const pages = this.renderedPages();
    const isBookMode = this.bookMode();

    if (isBookMode) {
      pages.forEach((page, index) => {
        const spread = document.createElement('div');
        spread.className = 'book-spread';
        spread.style.cssText = `
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: flex-start !important;
          justify-content: center !important;
          gap: 0 !important;
        `;

        const leftPage = this.createPageElement(page, index);
        leftPage.classList.add('left-page');
        leftPage.style.flex = '0 0 auto';
        spread.appendChild(leftPage);

        const rightPage = this.createBlankNotePageElement(index);
        rightPage.classList.add('right-page');
        rightPage.style.flex = '0 0 auto';
        spread.appendChild(rightPage);

        zoomContent.appendChild(spread);
      });
    } else {
      pages.forEach((page, index) => {
        const pageWrapper = this.createPageElement(page, index);
        zoomContent.appendChild(pageWrapper);
      });
    }

    container.appendChild(zoomContent);
  }

  private createPageElement(page: RenderedPage, index: number): HTMLDivElement {
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-wrapper';
    pageWrapper.setAttribute('data-page-id', page.pageId);
    pageWrapper.setAttribute('data-index', `${index}`);

    // Container for canvas layers
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.style.position = 'relative';
    canvasContainer.style.display = 'inline-block';

    page.canvas.className = 'pdf-page-canvas';
    canvasContainer.appendChild(page.canvas);

    // Create annotation canvas overlay
    const annotationCanvas = this.createAnnotationCanvas(page.canvas, index);
    page.annotationCanvas = annotationCanvas;
    canvasContainer.appendChild(annotationCanvas);

    pageWrapper.appendChild(canvasContainer);

    return pageWrapper;
  }

  private createAnnotationCanvas(baseCanvas: HTMLCanvasElement, pageIndex: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'annotation-canvas';
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    canvas.style.width = baseCanvas.style.width;
    canvas.style.height = baseCanvas.style.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'auto';
    canvas.setAttribute('data-page-index', `${pageIndex}`);

    // Add drawing event listeners
    canvas.addEventListener('pointerdown', (e) => this.onDrawStart(e, canvas, pageIndex));
    canvas.addEventListener('pointermove', (e) => this.onDrawMove(e, canvas, pageIndex));
    canvas.addEventListener('pointerup', (e) => this.onDrawEnd(e, pageIndex));
    canvas.addEventListener('pointerleave', (e) => this.onDrawEnd(e, pageIndex));

    return canvas;
  }

  private onDrawStart(e: PointerEvent, canvas: HTMLCanvasElement, pageIndex: number): void {
    const tool = this.currentTool();
    if (tool === 'none' || tool === 'select') return;

    e.preventDefault();
    e.stopPropagation();

    const point = this.getCanvasPoint(e, canvas);

    // Handle text tool separately
    if (tool === 'text') {
      // Check if clicking on existing textBox
      const existingTextBox = this.findTextBoxAtPoint(point, pageIndex);
      if (existingTextBox) {
        this.editTextBox(canvas, existingTextBox, pageIndex);
      } else {
        this.createTextInput(canvas, point, pageIndex);
      }
      return;
    }

    this.isDrawing = true;
    this.activeAnnotationCanvas = canvas;
    this.activePageIndex = pageIndex;

    if (tool === 'eraser') {
      this.eraseAtPoint(point, canvas, pageIndex);
    } else {
      this.currentStroke = {
        points: [point],
        color: tool === 'highlighter' ? this.highlighterColor() : this.penColor(),
        width: tool === 'highlighter' ? this.highlighterWidth() : this.penWidth(),
        tool: tool
      };
    }

    canvas.setPointerCapture(e.pointerId);
  }

  private createTextInput(canvas: HTMLCanvasElement, point: Point, pageIndex: number): void {
    const scale = this.viewScale();

    // Calculate position relative to canvas container
    const x = point.x / (window.devicePixelRatio || 1);
    const y = point.y / (window.devicePixelRatio || 1);

    // Create text input element
    const input = document.createElement('textarea');
    input.className = 'text-input-overlay';
    input.style.cssText = `
      position: absolute;
      left: ${x * scale}px;
      top: ${y * scale}px;
      min-width: 100px;
      min-height: 24px;
      padding: 4px 8px;
      border: 2px solid var(--rose-elegant, #c77d94);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.95);
      font-size: ${14 * scale}px;
      font-family: inherit;
      color: ${this.penColor()};
      resize: both;
      outline: none;
      z-index: 100;
    `;

    // Find canvas container and append input
    const container = canvas.parentElement;
    if (!container) return;

    container.appendChild(input);
    input.focus();

    // Handle blur to save text
    const saveText = () => {
      const text = input.value.trim();
      if (text) {
        const textBox: TextBox = {
          id: `text-${Date.now()}`,
          x: point.x,
          y: point.y,
          width: input.offsetWidth / scale,
          height: input.offsetHeight / scale,
          text: text,
          fontSize: 14,
          color: this.penColor()
        };

        if (pageIndex >= 1000) {
          // Note page
          const noteIndex = pageIndex - 1000;
          if (!this.notePageTextBoxes.has(noteIndex)) {
            this.notePageTextBoxes.set(noteIndex, []);
          }
          this.notePageTextBoxes.get(noteIndex)!.push(textBox);
          this.redrawNoteAnnotations(pageIndex);
          this.triggerSave(pageIndex);
        } else {
          // PDF page
          const pages = this.renderedPages();
          const page = pages[pageIndex];
          if (page) {
            page.textBoxes.push(textBox);
            this.redrawAnnotations(page);
            this.triggerSave(pageIndex, page.documentId);
          }
        }
      }
      input.remove();
    };

    input.addEventListener('blur', saveText);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.remove();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveText();
      }
    });
  }

  private notePageTextBoxes: Map<number, TextBox[]> = new Map();

  private findTextBoxAtPoint(point: Point, pageIndex: number): TextBox | null {
    const dpr = window.devicePixelRatio || 1;
    let textBoxes: TextBox[];

    if (pageIndex >= 1000) {
      const noteIndex = pageIndex - 1000;
      textBoxes = this.notePageTextBoxes.get(noteIndex) || [];
    } else {
      const pages = this.renderedPages();
      const page = pages[pageIndex];
      textBoxes = page?.textBoxes || [];
    }

    // Check from last to first (top-most first)
    for (let i = textBoxes.length - 1; i >= 0; i--) {
      const tb = textBoxes[i];
      const hitPadding = 10 * dpr;
      const textWidth = tb.text.length * tb.fontSize * dpr * 0.6; // Approximate width
      const textHeight = tb.fontSize * dpr * 1.5 * tb.text.split('\n').length;

      if (point.x >= tb.x - hitPadding &&
          point.x <= tb.x + textWidth + hitPadding &&
          point.y >= tb.y - hitPadding &&
          point.y <= tb.y + textHeight + hitPadding) {
        return tb;
      }
    }
    return null;
  }

  private editTextBox(canvas: HTMLCanvasElement, textBox: TextBox, pageIndex: number): void {
    const scale = this.viewScale();
    const dpr = window.devicePixelRatio || 1;

    const x = textBox.x / dpr;
    const y = textBox.y / dpr;

    const input = document.createElement('textarea');
    input.className = 'text-input-overlay';
    input.value = textBox.text;
    input.style.cssText = `
      position: absolute;
      left: ${x * scale}px;
      top: ${y * scale}px;
      min-width: 100px;
      min-height: 24px;
      padding: 4px 8px;
      border: 2px solid var(--rose-elegant, #c77d94);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.95);
      font-size: ${textBox.fontSize * scale}px;
      font-family: inherit;
      color: ${textBox.color};
      resize: both;
      outline: none;
      z-index: 100;
    `;

    const container = canvas.parentElement;
    if (!container) return;

    container.appendChild(input);
    input.focus();
    input.select();

    const saveText = () => {
      const newText = input.value.trim();
      if (newText) {
        textBox.text = newText;
        textBox.color = this.penColor();
      } else {
        // Remove empty textbox
        this.removeTextBox(textBox, pageIndex);
      }

      if (pageIndex >= 1000) {
        this.redrawNoteAnnotations(pageIndex);
        this.triggerSave(pageIndex);
      } else {
        const pages = this.renderedPages();
        const page = pages[pageIndex];
        if (page) {
          this.redrawAnnotations(page);
          this.triggerSave(pageIndex, page.documentId);
        }
      }
      input.remove();
    };

    input.addEventListener('blur', saveText);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.remove();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveText();
      }
    });
  }

  private removeTextBox(textBox: TextBox, pageIndex: number): void {
    if (pageIndex >= 1000) {
      const noteIndex = pageIndex - 1000;
      const textBoxes = this.notePageTextBoxes.get(noteIndex) || [];
      const idx = textBoxes.findIndex(tb => tb.id === textBox.id);
      if (idx !== -1) textBoxes.splice(idx, 1);
    } else {
      const pages = this.renderedPages();
      const page = pages[pageIndex];
      if (page) {
        const idx = page.textBoxes.findIndex(tb => tb.id === textBox.id);
        if (idx !== -1) page.textBoxes.splice(idx, 1);
      }
    }
  }

  private onDrawMove(e: PointerEvent, canvas: HTMLCanvasElement, pageIndex: number): void {
    if (!this.isDrawing || this.activePageIndex !== pageIndex) return;

    e.preventDefault();
    e.stopPropagation();

    const tool = this.currentTool();
    const point = this.getCanvasPoint(e, canvas);

    if (tool === 'eraser') {
      this.eraseAtPoint(point, canvas, pageIndex);
    } else if (this.currentStroke) {
      this.currentStroke.points.push(point);
      this.drawCurrentStroke(canvas);
    }
  }

  private onDrawEnd(e: PointerEvent, pageIndex: number): void {
    if (!this.isDrawing || this.activePageIndex !== pageIndex) return;

    e.preventDefault();

    if (this.currentStroke && this.currentStroke.points.length > 1) {
      // Check if it's a note page (index >= 1000)
      if (pageIndex >= 1000) {
        const noteIndex = pageIndex - 1000;
        if (!this.notePageStrokes.has(noteIndex)) {
          this.notePageStrokes.set(noteIndex, []);
        }
        this.notePageStrokes.get(noteIndex)!.push(this.currentStroke);
        this.redrawNoteAnnotations(pageIndex);
        this.triggerSave(pageIndex);
      } else {
        const pages = this.renderedPages();
        const page = pages[pageIndex];
        if (page) {
          page.strokes.push(this.currentStroke);
          this.redrawAnnotations(page);
          this.triggerSave(pageIndex, page.documentId);
        }
      }
    }

    this.isDrawing = false;
    this.currentStroke = null;
    this.activeAnnotationCanvas = null;
    this.activePageIndex = -1;
  }

  private redrawNoteAnnotations(pageIndex: number): void {
    const noteIndex = pageIndex - 1000;
    const strokes = this.notePageStrokes.get(noteIndex) || [];
    const textBoxes = this.notePageTextBoxes.get(noteIndex) || [];

    const container = this.pagesContainerRef?.nativeElement;
    if (!container) return;

    const canvas = container.querySelector(`canvas.annotation-canvas[data-page-index="${pageIndex}"]`) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * dpr;

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
        ctx.globalCompositeOperation = 'multiply';
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        const p0 = stroke.points[i - 1];
        const p1 = stroke.points[i];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }

      const lastPoint = stroke.points[stroke.points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
      ctx.restore();
    }

    // Draw text boxes
    for (const textBox of textBoxes) {
      ctx.save();
      ctx.font = `${textBox.fontSize * dpr}px sans-serif`;
      ctx.fillStyle = textBox.color;
      ctx.textBaseline = 'top';

      const lines = textBox.text.split('\n');
      const lineHeight = textBox.fontSize * dpr * 1.2;

      lines.forEach((line, index) => {
        ctx.fillText(line, textBox.x, textBox.y + (index * lineHeight));
      });

      ctx.restore();
    }
  }

  private getCanvasPoint(e: PointerEvent, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure || 0.5
    };
  }

  private drawCurrentStroke(canvas: HTMLCanvasElement): void {
    if (!this.currentStroke || this.currentStroke.points.length < 2) return;

    const ctx = canvas.getContext('2d')!;
    const stroke = this.currentStroke;
    const points = stroke.points;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * (window.devicePixelRatio || 1);

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'multiply';
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
    }

    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();
    ctx.restore();
  }

  private redrawAnnotations(page: RenderedPage): void {
    if (!page.annotationCanvas) return;

    const canvas = page.annotationCanvas;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw strokes
    for (const stroke of page.strokes) {
      if (stroke.points.length < 2) continue;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width * dpr;

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
        ctx.globalCompositeOperation = 'multiply';
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        const p0 = stroke.points[i - 1];
        const p1 = stroke.points[i];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }

      const lastPoint = stroke.points[stroke.points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
      ctx.restore();
    }

    // Draw text boxes
    for (const textBox of page.textBoxes) {
      ctx.save();
      ctx.font = `${textBox.fontSize * dpr}px sans-serif`;
      ctx.fillStyle = textBox.color;
      ctx.textBaseline = 'top';

      const lines = textBox.text.split('\n');
      const lineHeight = textBox.fontSize * dpr * 1.2;

      lines.forEach((line, index) => {
        ctx.fillText(line, textBox.x, textBox.y + (index * lineHeight));
      });

      ctx.restore();
    }
  }

  private eraseAtPoint(point: Point, _canvas: HTMLCanvasElement, pageIndex: number): void {
    const eraserSize = this.eraserWidth() * (window.devicePixelRatio || 1);

    // Check if it's a note page (index >= 1000)
    if (pageIndex >= 1000) {
      const noteIndex = pageIndex - 1000;
      const strokes = this.notePageStrokes.get(noteIndex) || [];
      const originalLength = strokes.length;

      const filteredStrokes = strokes.filter(stroke => {
        return !stroke.points.some(p => {
          const dx = p.x - point.x;
          const dy = p.y - point.y;
          return Math.sqrt(dx * dx + dy * dy) < eraserSize;
        });
      });

      this.notePageStrokes.set(noteIndex, filteredStrokes);
      this.redrawNoteAnnotations(pageIndex);

      // Trigger save if strokes were deleted
      if (filteredStrokes.length !== originalLength) {
        this.triggerSave(pageIndex);
      }
    } else {
      const pages = this.renderedPages();
      const page = pages[pageIndex];
      if (!page) return;

      const originalLength = page.strokes.length;

      // Remove strokes that intersect with eraser
      page.strokes = page.strokes.filter(stroke => {
        return !stroke.points.some(p => {
          const dx = p.x - point.x;
          const dy = p.y - point.y;
          return Math.sqrt(dx * dx + dy * dy) < eraserSize;
        });
      });

      this.redrawAnnotations(page);

      // Trigger save if strokes were deleted
      if (page.strokes.length !== originalLength) {
        this.triggerSave(pageIndex, page.documentId);
      }
    }
  }

  // Tool selection methods
  setTool(tool: DrawingTool): void {
    this.currentTool.set(tool);
  }

  setPenColor(color: string): void {
    this.penColor.set(color);
  }

  setPenWidth(width: number): void {
    this.penWidth.set(width);
  }

  setHighlighterColor(color: string): void {
    this.highlighterColor.set(color);
  }

  clearAnnotations(pageIndex: number): void {
    const pages = this.renderedPages();
    const page = pages[pageIndex];
    if (page) {
      page.strokes = [];
      this.redrawAnnotations(page);
    }
  }

  // Trigger save with debounce
  private triggerSave(pageIndex: number, documentId?: string): void {
    this.saveAnnotations$.next({ pageIndex, documentId });
  }

  // Save annotations to backend
  private savePageAnnotations(pageIndex: number, documentId?: string): void {
    if (pageIndex >= 1000) {
      // Note page - save to note pages storage (could be separate endpoint)
      const noteIndex = pageIndex - 1000;
      const strokes = this.notePageStrokes.get(noteIndex) || [];
      const textBoxes = this.notePageTextBoxes.get(noteIndex) || [];

      // For note pages, save as a special note type
      if (strokes.length > 0 || textBoxes.length > 0) {
        console.log('Saving note page annotations:', { noteIndex, strokes: strokes.length, textBoxes: textBoxes.length });
        // Note pages are saved in localStorage for now
        const noteKey = `notePage-${noteIndex}`;
        const noteData = { strokes, textBoxes };
        localStorage.setItem(noteKey, JSON.stringify(noteData));
      }
    } else if (documentId) {
      // PDF page - save to notes API
      const pages = this.renderedPages();
      const page = pages[pageIndex];
      if (!page) return;

      const hasInk = page.strokes.length > 0;
      const hasText = page.textBoxes.length > 0;

      if (!hasInk && !hasText) return;

      // Determine mode based on content
      const noteMode = hasInk ? 'ink' : 'text';

      // Convert strokes to API format (only if has ink)
      const inkData = hasInk ? {
        strokes: page.strokes.map(s => ({
          points: s.points.map(p => ({ x: p.x, y: p.y })),
          width: s.width,
          color: s.color
        }))
      } : undefined;

      // Convert textBoxes to JSON string with full metadata
      const textContent = hasText
        ? JSON.stringify(page.textBoxes)
        : undefined;

      const noteKey = `${documentId}-${pageIndex}`;
      const existingNoteId = this.pageNoteIds.get(noteKey);

      if (existingNoteId) {
        // Update existing note
        const updateDto: any = {
          mode: noteMode,
          text: textContent
        };
        if (inkData) {
          updateDto.ink = inkData;
        }

        this.notesService.updateNote(existingNoteId, updateDto).subscribe({
          next: () => console.log('Annotations updated for page', pageIndex),
          error: (err) => console.error('Error updating annotations:', err)
        });
      } else {
        // Create new note
        const createDto: any = {
          documentId: documentId,
          pageIndex: pageIndex,
          mode: noteMode,
          text: textContent,
          color: '#ffd700'
        };
        if (inkData) {
          createDto.ink = inkData;
        }

        this.notesService.createNote(createDto).subscribe({
          next: (response) => {
            console.log('Annotations saved for page', pageIndex);
            // Store the note ID for future updates
            this.pageNoteIds.set(noteKey, response.data._id);
          },
          error: (err) => console.error('Error saving annotations:', err)
        });
      }
    }
  }

  // Load annotations from backend
  private loadAnnotationsForPage(documentId: string, pageIndex: number, page: RenderedPage): void {
    this.notesService.getAllNotes({ documentId, pageIndex }).subscribe({
      next: (response) => {
        if (response.success && response.data.length > 0) {
          const note = response.data[0]; // Get first note for this page

          // Store the note ID for future updates
          const noteKey = `${documentId}-${pageIndex}`;
          this.pageNoteIds.set(noteKey, note._id);

          if (note.ink?.strokes) {
            page.strokes = note.ink.strokes.map(s => ({
              points: s.points.map(p => ({ x: p.x, y: p.y })),
              color: s.color,
              width: s.width,
              tool: 'pen' as DrawingTool
            }));
          }

          if (note.text) {
            // Try to parse as JSON (new format with positions)
            try {
              const parsedTextBoxes = JSON.parse(note.text) as TextBox[];
              if (Array.isArray(parsedTextBoxes)) {
                page.textBoxes = parsedTextBoxes.map((tb, idx) => ({
                  id: tb.id || `loaded-${idx}`,
                  x: tb.x,
                  y: tb.y,
                  width: tb.width || 200,
                  height: tb.height || 24,
                  text: tb.text,
                  fontSize: tb.fontSize || 14,
                  color: tb.color || '#000000'
                }));
              }
            } catch {
              // Fallback: old format (plain text separated by ---)
              const texts = note.text.split('\n---\n');
              texts.forEach((text, idx) => {
                if (text.trim()) {
                  page.textBoxes.push({
                    id: `loaded-${idx}`,
                    x: 50 * (window.devicePixelRatio || 1),
                    y: (50 + (idx * 40)) * (window.devicePixelRatio || 1),
                    width: 200,
                    height: 24,
                    text: text.trim(),
                    fontSize: 14,
                    color: note.color || '#000000'
                  });
                }
              });
            }
          }

          this.redrawAnnotations(page);
        }
      },
      error: (err) => console.error('Error loading annotations:', err)
    });
  }

  private createBlankNotePageElement(index: number): HTMLDivElement {
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-wrapper note-page';
    pageWrapper.setAttribute('data-index', `note-${index}`);

    // Container for canvas layers
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.style.position = 'relative';
    canvasContainer.style.display = 'inline-block';

    const canvas = document.createElement('canvas');
    const width = 595;
    const height = 842;
    const outputScale = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * this.scale() * outputScale);
    canvas.height = Math.floor(height * this.scale() * outputScale);
    canvas.style.width = Math.floor(width * this.scale()) + 'px';
    canvas.style.height = Math.floor(height * this.scale()) + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.scale(outputScale, outputScale);
    ctx.fillStyle = '#fffef5';
    ctx.fillRect(0, 0, width * this.scale(), height * this.scale());

    ctx.strokeStyle = '#e8e4d9';
    ctx.lineWidth = 1;
    const lineHeight = 25 * this.scale();
    for (let y = lineHeight * 2; y < height * this.scale(); y += lineHeight) {
      ctx.beginPath();
      ctx.moveTo(20 * this.scale(), y);
      ctx.lineTo((width - 20) * this.scale(), y);
      ctx.stroke();
    }

    canvas.className = 'pdf-page-canvas note-canvas';
    canvasContainer.appendChild(canvas);

    // Create annotation canvas overlay for notes page
    const notePageIndex = 1000 + index; // Use offset to distinguish from PDF pages
    const annotationCanvas = this.createAnnotationCanvas(canvas, notePageIndex);
    canvasContainer.appendChild(annotationCanvas);

    // Load existing annotations for this note page from localStorage
    this.loadNotePageAnnotations(index, annotationCanvas);

    pageWrapper.appendChild(canvasContainer);

    return pageWrapper;
  }

  // Load note page annotations from localStorage
  private loadNotePageAnnotations(noteIndex: number, _annotationCanvas: HTMLCanvasElement): void {
    const noteKey = `notePage-${noteIndex}`;
    const savedData = localStorage.getItem(noteKey);

    if (savedData) {
      try {
        const { strokes, textBoxes } = JSON.parse(savedData);

        if (strokes && Array.isArray(strokes)) {
          this.notePageStrokes.set(noteIndex, strokes);
        }

        if (textBoxes && Array.isArray(textBoxes)) {
          this.notePageTextBoxes.set(noteIndex, textBoxes);
        }

        // Redraw after loading
        const pageIndex = 1000 + noteIndex;
        setTimeout(() => this.redrawNoteAnnotations(pageIndex), 100);
      } catch (err) {
        console.error('Error loading note page annotations:', err);
      }
    }
  }

  // Store note page strokes separately
  private notePageStrokes: Map<number, Stroke[]> = new Map();

  // Store existing note IDs for updates instead of creates
  private pageNoteIds: Map<string, string> = new Map(); // key: "docId-pageIndex", value: noteId

  private insertThumbnailsToDom(): void {
    if (!this.thumbnailsContainerRef?.nativeElement) return;

    const container = this.thumbnailsContainerRef.nativeElement;
    container.innerHTML = '';

    const pages = this.renderedPages();

    pages.forEach((page, index) => {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'thumbnail-wrapper';
      thumbWrapper.setAttribute('data-page-id', page.pageId);
      thumbWrapper.setAttribute('data-index', `${index}`);

      if (page.thumbnail) {
        page.thumbnail.className = 'thumbnail-canvas';
        thumbWrapper.appendChild(page.thumbnail);
      }

      const controls = document.createElement('div');
      controls.className = 'thumbnail-controls';

      const moveUpBtn = document.createElement('button');
      moveUpBtn.className = 'thumb-btn';
      moveUpBtn.innerHTML = '▲';
      moveUpBtn.title = 'Mover arriba';
      moveUpBtn.disabled = index === 0;
      moveUpBtn.onclick = (e) => {
        e.stopPropagation();
        this.movePageUp(page.pageId);
      };

      const moveDownBtn = document.createElement('button');
      moveDownBtn.className = 'thumb-btn';
      moveDownBtn.innerHTML = '▼';
      moveDownBtn.title = 'Mover abajo';
      moveDownBtn.disabled = index === pages.length - 1;
      moveDownBtn.onclick = (e) => {
        e.stopPropagation();
        this.movePageDown(page.pageId);
      };

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'thumb-btn thumb-btn-delete';
      deleteBtn.innerHTML = '✕';
      deleteBtn.title = 'Eliminar página';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deletePage(page.pageId);
      };

      controls.appendChild(moveUpBtn);
      controls.appendChild(moveDownBtn);
      controls.appendChild(deleteBtn);
      thumbWrapper.appendChild(controls);

      const pageNum = document.createElement('div');
      pageNum.className = 'thumbnail-page-num';
      pageNum.textContent = `${index + 1}`;
      thumbWrapper.appendChild(pageNum);

      thumbWrapper.addEventListener('click', () => {
        this.scrollToPage(index);
      });

      container.appendChild(thumbWrapper);
    });
  }

  movePageUp(pageId: string): void {
    this.notebookService.movePage(pageId, 'up').subscribe({
      error: (err) => console.error('Error moviendo página:', err)
    });
  }

  movePageDown(pageId: string): void {
    this.notebookService.movePage(pageId, 'down').subscribe({
      error: (err) => console.error('Error moviendo página:', err)
    });
  }

  deletePage(pageId: string): void {
    if (confirm('¿Eliminar esta página del cuaderno?')) {
      this.notebookService.deletePage(pageId).subscribe({
        error: (err) => console.error('Error eliminando página:', err)
      });
    }
  }

  zoomIn(): void {
    if (this.viewScale() < 3.0) {
      this.viewScale.update(s => Math.round((s + 0.1) * 100) / 100);
      this.applyViewScale();
    }
  }

  zoomOut(): void {
    if (this.viewScale() > 0.3) {
      this.viewScale.update(s => Math.round((s - 0.1) * 100) / 100);
      this.applyViewScale();
    }
  }

  resetZoom(): void {
    this.viewScale.set(1.0);
    this.applyViewScale();
  }

  getZoomPercentage(): number {
    return Math.round(this.viewScale() * 100);
  }

  retry(): void {
    this.notebookService.loadActiveNotebook().subscribe({
      next: () => {},
      error: (err) => console.error('Error recargando notebook:', err)
    });
  }

  toggleThumbnails(): void {
    this.showThumbnails.update(v => !v);
  }

  toggleBookMode(): void {
    this.bookMode.update(v => !v);
    this.insertCanvasesToDom();
    this.insertThumbnailsToDom();
  }

  scrollToPage(index: number): void {
    if (!this.pagesContainerRef?.nativeElement) return;

    const container = this.pagesContainerRef.nativeElement;
    const pageWrappers = container.querySelectorAll('.page-wrapper');

    if (pageWrappers[index]) {
      pageWrappers[index].scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }
}
