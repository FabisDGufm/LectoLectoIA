const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pdf', 'blank'],
    required: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: function() { return this.type === 'pdf'; }
  },
  pageNumber: {
    type: Number,
    required: function() { return this.type === 'pdf'; }
  },
  order: {
    type: Number,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const notebookSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [255, 'El nombre no puede exceder 255 caracteres'],
      default: 'Mi Cuaderno'
    },
    pages: [pageSchema],
    bookModeEnabled: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

notebookSchema.virtual('totalPages').get(function() {
  return this.pages.filter(p => p.visible).length;
});

notebookSchema.virtual('pdfPages').get(function() {
  return this.pages.filter(p => p.type === 'pdf' && p.visible).length;
});

notebookSchema.virtual('blankPages').get(function() {
  return this.pages.filter(p => p.type === 'blank' && p.visible).length;
});

notebookSchema.index({ isActive: 1 });
notebookSchema.index({ createdAt: -1 });

const Notebook = mongoose.model('Notebook', notebookSchema);

module.exports = Notebook;
