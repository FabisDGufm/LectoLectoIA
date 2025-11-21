import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';
import { NotebookService, NotebookPage } from '../../services/notebook.service';
import { DocumentsService } from '../../services/documents.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface RenderedPage {
  pageId: string;
  documentId?: string;
  documentTitle?: string;
  pageNumber?: number;
  type: 'pdf' | 'blank';
  order: number;
  canvas: HTMLCanvasElement;
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

  private loadedPdfs: Map<string, pdfjsLib.PDFDocumentProxy> = new Map();
  private isDestroyed = false;

  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private scrollLeft = 0;
  private scrollTop = 0;
  private lastTouchDistance = 0;
  private initialPinchScale = 1;

  pages = this.notebookService.pages;
  hasPages = this.notebookService.hasPages;

  constructor() {
    effect(() => {
      const notebookPages = this.pages();
      if (notebookPages.length > 0 && !this.isDestroyed) {
        this.loadNotebookPages(notebookPages);
      }
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

    // Escalar todos los canvas
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
            thumbnail
          });
        } else if (page.type === 'blank') {
          const canvas = this.createBlankCanvas();
          const thumbnail = this.createBlankThumbnail();

          allPages.push({
            pageId: page._id,
            type: 'blank',
            order: page.order,
            canvas,
            thumbnail
          });
        }
      }

      this.totalPagesAll.set(allPages.length);
      this.renderedPages.set(allPages);
      this.isLoading.set(false);

      this.cdr.detectChanges();

      this.insertCanvasesToDom();
      this.insertThumbnailsToDom();

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

    page.canvas.className = 'pdf-page-canvas';
    pageWrapper.appendChild(page.canvas);

    const pageLabel = document.createElement('div');
    pageLabel.className = 'page-label';
    if (page.type === 'pdf') {
      pageLabel.textContent = `${page.documentTitle} - Pág. ${page.pageNumber}`;
    } else {
      pageLabel.textContent = `Página en blanco`;
    }
    pageWrapper.appendChild(pageLabel);

    return pageWrapper;
  }

  private createBlankNotePageElement(index: number): HTMLDivElement {
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'page-wrapper note-page';
    pageWrapper.setAttribute('data-index', `${index}`);

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
    pageWrapper.appendChild(canvas);

    const pageLabel = document.createElement('div');
    pageLabel.className = 'page-label';
    pageLabel.textContent = `Notas`;
    pageWrapper.appendChild(pageLabel);

    return pageWrapper;
  }

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
