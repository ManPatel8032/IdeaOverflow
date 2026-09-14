/* ═══════════════════════════════════════════
   Paper Document — Live JS model of paper.json
   Source of truth for the paper tree structure.
   All editor mutations go through this object.

   Usage:
     // Load from server:
     window.paperDoc = PaperDocument.fromJSON(serverData);

     // Mutate (auto-syncs to editor & auto-saves):
     paperDoc.setTitle('New Title');
     paperDoc.addSection('Methods', 'We used...');
     paperDoc.addSubsection(0, 'Data Collection', 'Surveys were...');

     // Inspect the live tree (paper.json format):
     console.log(paperDoc.toJSON());

     // Access sections directly:
     console.log(paperDoc.content[0].title);
     console.log(paperDoc.content[0].content); // paragraphs, subsections, etc.
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  class PaperDocument {
    constructor() {
      this.title = '';
      this.authors = [];
      this.abstract = '';
      this.content = [];      // tree nodes matching paper.json: [{type:'section', title, content:[...]}]
      this.references = [];
    }

    /** Create a PaperDocument from a paper.json object */
    static fromJSON(json) {
      var doc = new PaperDocument();
      if (!json || typeof json !== 'object') return doc;
      doc.title = json.title || '';
      doc.authors = (json.authors || []).map(function (a) {
        return { name: a.name || '', affiliation: a.affiliation || '', email: a.email || '' };
      });
      doc.abstract = json.abstract || '';
      doc.content = JSON.parse(JSON.stringify(json.content || []));
      doc.references = (json.references || []).map(function (r) {
        return { id: r.id || '', citation: r.citation || '' };
      });
      return doc;
    }

    /** Serialize to paper.json format */
    toJSON() {
      return {
        title: this.title,
        authors: this.authors.map(function (a) {
          return { name: a.name, affiliation: a.affiliation, email: a.email };
        }),
        abstract: this.abstract,
        content: JSON.parse(JSON.stringify(this.content)),
        references: this.references.map(function (r) {
          return { id: r.id, citation: r.citation };
        }),
      };
    }

    /** Convert to flat PaperDoc format used by editor rendering */
    toFlatDoc() {
      return window.Parser.transformPaperJsonToDoc(this.toJSON());
    }

    /* ── Title / Abstract ── */

    setTitle(title) {
      this.title = title;
      this._notify();
    }

    setAbstract(text) {
      this.abstract = text;
      this._notify();
    }

    /* ── Authors ── */

    addAuthor(name, affiliation, email) {
      this.authors.push({
        name: name || '',
        affiliation: affiliation || '',
        email: email || '',
      });
      this._notify();
    }

    removeAuthor(index) {
      if (index >= 0 && index < this.authors.length) {
        this.authors.splice(index, 1);
        this._notify();
      }
    }

    updateAuthor(index, updates) {
      if (index >= 0 && index < this.authors.length) {
        Object.assign(this.authors[index], updates);
        this._notify();
      }
    }

    /* ── Sections ── */

    /**
     * Add a section.
     * @param {string} title
     * @param {string} contentText - paragraph text (double-newlines split into multiple paragraphs)
     * @param {number|string} position - 0/'start' = top, number = insert at index, undefined = append
     */
    addSection(title, contentText, position) {
      var section = {
        type: 'section',
        title: title || 'Untitled Section',
        content: [],
      };
      if (contentText) {
        contentText.split(/\n\s*\n/).filter(Boolean).forEach(function (p) {
          section.content.push({ type: 'paragraph', text: p.trim() });
        });
      }
      if (position === 'start' || position === 0) {
        this.content.unshift(section);
      } else if (typeof position === 'number') {
        this.content.splice(position, 0, section);
      } else {
        this.content.push(section);
      }
      this._notify();
      return section;
    }

    updateSectionTitle(sectionIndex, title) {
      var sec = this.content[sectionIndex];
      if (sec) {
        sec.title = title;
        this._notify();
      }
    }

    /** Update paragraph text of a section (replaces paragraph nodes, keeps subsections/tables/images) */
    updateSectionContent(sectionIndex, text) {
      var sec = this.content[sectionIndex];
      if (!sec) return;
      var nonParagraphs = sec.content.filter(function (n) { return n.type !== 'paragraph'; });
      var paragraphs = text
        ? text.split(/\n\s*\n/).filter(Boolean).map(function (t) { return { type: 'paragraph', text: t.trim() }; })
        : [];
      sec.content = paragraphs.concat(nonParagraphs);
      this._notify();
    }

    removeSection(sectionIndex) {
      if (sectionIndex >= 0 && sectionIndex < this.content.length) {
        this.content.splice(sectionIndex, 1);
        this._notify();
      }
    }

    /* ── Subsections ── */

    addSubsection(sectionIndex, title, contentText) {
      var sec = this.content[sectionIndex];
      if (!sec) return null;
      var sub = {
        type: 'subsection',
        title: title || 'Untitled Subsection',
        content: [],
      };
      if (contentText) {
        contentText.split(/\n\s*\n/).filter(Boolean).forEach(function (p) {
          sub.content.push({ type: 'paragraph', text: p.trim() });
        });
      }
      sec.content.push(sub);
      this._notify();
      return sub;
    }

    updateSubsectionTitle(sectionIndex, subIndex, title) {
      var sub = this._getSubsection(sectionIndex, subIndex);
      if (sub) {
        sub.title = title;
        this._notify();
      }
    }

    updateSubsectionContent(sectionIndex, subIndex, text) {
      var sub = this._getSubsection(sectionIndex, subIndex);
      if (!sub) return;
      var nonParagraphs = sub.content.filter(function (n) { return n.type !== 'paragraph'; });
      var paragraphs = text
        ? text.split(/\n\s*\n/).filter(Boolean).map(function (t) { return { type: 'paragraph', text: t.trim() }; })
        : [];
      sub.content = paragraphs.concat(nonParagraphs);
      this._notify();
    }

    removeSubsection(sectionIndex, subIndex) {
      var sec = this.content[sectionIndex];
      if (!sec) return;
      var subs = sec.content.filter(function (n) { return n.type === 'subsection'; });
      var target = subs[subIndex];
      if (target) {
        sec.content = sec.content.filter(function (n) { return n !== target; });
        this._notify();
      }
    }

    /* ── Tables ── */

    addTable(sectionIndex, caption, headers, data) {
      var table = {
        type: 'table',
        columns: (headers || []).length,
        caption: caption || '',
        headers: headers || [],
        data: data || [],
      };
      var idx = (sectionIndex != null && this.content[sectionIndex])
        ? sectionIndex
        : this.content.length - 1;
      if (idx >= 0 && this.content[idx]) {
        this.content[idx].content.push(table);
      }
      this._notify();
      return table;
    }

    /** Update a table cell, header, or caption. Finds the nth table across all sections. */
    updateTableCell(tableIndex, rowIdx, colIdx, value) {
      var table = this._getTable(tableIndex);
      if (table && table.data[rowIdx]) {
        table.data[rowIdx][colIdx] = value;
        this._notify();
      }
    }

    updateTableHeader(tableIndex, colIdx, value) {
      var table = this._getTable(tableIndex);
      if (table && table.headers) {
        table.headers[colIdx] = value;
        this._notify();
      }
    }

    updateTableCaption(tableIndex, caption) {
      var table = this._getTable(tableIndex);
      if (table) {
        table.caption = caption;
        this._notify();
      }
    }

    removeTable(tableIndex) {
      var count = 0;
      for (var s = 0; s < this.content.length; s++) {
        var sec = this.content[s];
        for (var c = 0; c < sec.content.length; c++) {
          if (sec.content[c].type === 'table') {
            if (count === tableIndex) {
              sec.content.splice(c, 1);
              this._notify();
              return;
            }
            count++;
          }
        }
      }
    }

    _getTable(tableIndex) {
      var count = 0;
      for (var s = 0; s < this.content.length; s++) {
        var sec = this.content[s];
        for (var c = 0; c < (sec.content || []).length; c++) {
          if (sec.content[c].type === 'table') {
            if (count === tableIndex) return sec.content[c];
            count++;
          }
        }
      }
      return null;
    }

    /* ── Images ── */

    addImage(sectionIndex, src, caption) {
      var image = {
        type: 'image',
        src: src || '',
        caption: caption || '',
      };
      var idx = (sectionIndex != null && this.content[sectionIndex])
        ? sectionIndex
        : this.content.length - 1;
      if (idx >= 0 && this.content[idx]) {
        this.content[idx].content.push(image);
      }
      this._notify();
      return image;
    }

    /* ── References ── */

    addReference(id, citation) {
      this.references.push({ id: id || '', citation: citation || '' });
      this._notify();
    }

    removeReference(index) {
      if (index >= 0 && index < this.references.length) {
        this.references.splice(index, 1);
        this._notify();
      }
    }

    /* ── Internal helpers ── */

    _getSubsection(sectionIndex, subIndex) {
      var sec = this.content[sectionIndex];
      if (!sec) return null;
      var subs = sec.content.filter(function (n) { return n.type === 'subsection'; });
      return subs[subIndex] || null;
    }

    /** Sync tree → flat AppState.doc and emit docChanged for re-rendering */
    _notify() {
      if (window.State) {
        State.setDoc(this.toFlatDoc());
      }
    }

    /** Save to server */
    save() {
      if (window.API) {
        return API.saveManuscript(this.toJSON());
      }
      return Promise.resolve();
    }
  }

  // Export class and singleton
  window.PaperDocument = PaperDocument;
  window.paperDoc = null;   // initialized in editor.js fetchManuscript()
})();
