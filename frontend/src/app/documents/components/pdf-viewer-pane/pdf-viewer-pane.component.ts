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
  isLoading = signal(false);
  error = signal<string | null>(null);
  renderedPages = signal<RenderedPage[]>([]);
  totalPagesAll = signal(0);
  showThumbnails = signal(false);

  private loadedPdfs: Map<string, pdfjsLib.PDFDocumentProxy> = new Map();
  private isDestroyed = false;

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

  ngAfterViewInit(): void {}

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

    const pages = this.renderedPages();

    pages.forEach((page, index) => {
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

      container.appendChild(pageWrapper);
    });
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

  async zoomIn(): Promise<void> {
    if (this.scale() < 3.0) {
      this.scale.update(s => Math.round((s + 0.25) * 100) / 100);
      await this.reRenderAll();
    }
  }

  async zoomOut(): Promise<void> {
    if (this.scale() > 0.5) {
      this.scale.update(s => Math.round((s - 0.25) * 100) / 100);
      await this.reRenderAll();
    }
  }

  async resetZoom(): Promise<void> {
    this.scale.set(1.0);
    await this.reRenderAll();
  }

  private async reRenderAll(): Promise<void> {
    const notebookPages = this.pages();
    if (notebookPages.length > 0) {
      await this.loadNotebookPages(notebookPages);
    }
  }

  getZoomPercentage(): number {
    return Math.round(this.scale() * 100);
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
