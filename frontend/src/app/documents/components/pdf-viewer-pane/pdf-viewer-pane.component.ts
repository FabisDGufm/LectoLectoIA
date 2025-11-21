import { Component, OnInit, OnDestroy, signal, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';
import { CurrentDocumentService, DocumentWithUrl } from '../../services/current-document.service';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

interface RenderedPage {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  totalPages: number;
  globalIndex: number;
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
  private readonly currentDocumentService = inject(CurrentDocumentService);

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

  activeDocuments = this.currentDocumentService.activeDocuments;
  hasDocuments = this.currentDocumentService.hasDocuments;

  constructor() {
    effect(() => {
      const docs = this.activeDocuments();
      if (docs.length > 0 && !this.isDestroyed) {
        this.loadAllDocuments(docs);
      }
    });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.loadedPdfs.forEach(pdf => pdf.destroy());
    this.loadedPdfs.clear();
  }

  async loadAllDocuments(documents: DocumentWithUrl[]): Promise<void> {
    if (documents.length === 0) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.renderedPages.set([]);

    try {
      const allPages: RenderedPage[] = [];
      let totalPages = 0;

      for (const docWithUrl of documents) {
        let pdfDoc = this.loadedPdfs.get(docWithUrl.document._id);

        if (!pdfDoc) {
          console.log('Cargando PDF:', docWithUrl.document.title);
          const loadingTask = pdfjsLib.getDocument(docWithUrl.pdfUrl);
          pdfDoc = await loadingTask.promise;
          this.loadedPdfs.set(docWithUrl.document._id, pdfDoc);
        }

        totalPages += pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const canvas = await this.renderPageToCanvas(pdfDoc, pageNum);
          const thumbnail = await this.renderThumbnail(pdfDoc, pageNum);
          allPages.push({
            documentId: docWithUrl.document._id,
            documentTitle: docWithUrl.document.title,
            pageNumber: pageNum,
            totalPages: pdfDoc.numPages,
            globalIndex: allPages.length,
            canvas,
            thumbnail
          });
        }
      }

      this.totalPagesAll.set(totalPages);
      this.renderedPages.set(allPages);
      this.isLoading.set(false);

      this.cdr.detectChanges();

      this.insertCanvasesToDom();
      this.insertThumbnailsToDom();

    } catch (err: any) {
      console.error('Error cargando documentos:', err);
      this.error.set(err.message || 'Error al cargar los documentos');
      this.isLoading.set(false);
    }
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

    pages.forEach((page) => {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'page-wrapper';
      pageWrapper.setAttribute('data-page', `${page.pageNumber}`);

      page.canvas.className = 'pdf-page-canvas';
      pageWrapper.appendChild(page.canvas);

      const pageLabel = document.createElement('div');
      pageLabel.className = 'page-label';
      pageLabel.textContent = `Página ${page.pageNumber} de ${page.totalPages}`;
      pageWrapper.appendChild(pageLabel);

      container.appendChild(pageWrapper);
    });
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
    const docs = this.activeDocuments();
    if (docs.length > 0) {
      await this.loadAllDocuments(docs);
    }
  }

  getZoomPercentage(): number {
    return Math.round(this.scale() * 100);
  }

  retry(): void {
    const docs = this.activeDocuments();
    if (docs.length > 0) {
      this.loadAllDocuments(docs);
    }
  }

  toggleThumbnails(): void {
    this.showThumbnails.update(v => !v);
  }

  private insertThumbnailsToDom(): void {
    if (!this.thumbnailsContainerRef?.nativeElement) return;

    const container = this.thumbnailsContainerRef.nativeElement;
    container.innerHTML = '';

    const pages = this.renderedPages();

    pages.forEach((page) => {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'thumbnail-wrapper';
      thumbWrapper.setAttribute('data-global-index', `${page.globalIndex}`);

      if (page.thumbnail) {
        page.thumbnail.className = 'thumbnail-canvas';
        thumbWrapper.appendChild(page.thumbnail);
      }

      const pageNum = document.createElement('div');
      pageNum.className = 'thumbnail-page-num';
      pageNum.textContent = `${page.pageNumber}`;
      thumbWrapper.appendChild(pageNum);

      thumbWrapper.addEventListener('click', () => {
        this.scrollToPage(page.globalIndex);
      });

      container.appendChild(thumbWrapper);
    });
  }

  scrollToPage(globalIndex: number): void {
    if (!this.pagesContainerRef?.nativeElement) return;

    const container = this.pagesContainerRef.nativeElement;
    const pageWrappers = container.querySelectorAll('.page-wrapper');

    if (pageWrappers[globalIndex]) {
      pageWrappers[globalIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }
}
