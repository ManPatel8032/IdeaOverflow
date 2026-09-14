/* ═══════════════════════════════════════════
   Document Model — Nested tree builder
   Paper → Sections → Subsections → Paragraphs / Equations
   Implements the hierarchy described in Project.md
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  // ── 1. Paper Object (Root) ──
  function createPaper(title, authors, abstract) {
    return {
      title: title || '',
      authors: Array.isArray(authors) ? authors : [],
      abstract: abstract || '',
      content: [],
      references: [],
    };
  }

  // ── 2. Section Object ──
  function createSection(title) {
    return {
      type: 'section',
      title: title || '',
      content: [],
    };
  }

  // ── 3. Subsection Object ──
  function createSubsection(title) {
    return {
      type: 'subsection',
      title: title || '',
      content: [],
    };
  }

  // ── 3b. Subsubsection Object ──
  function createSubsubsection(title) {
    return {
      type: 'subsubsection',
      title: title || '',
      content: [],
    };
  }

  // ── 4. Paragraph Object ──
  function createParagraph(text) {
    return {
      type: 'paragraph',
      text: text || '',
    };
  }

  // ── 5. Equation Object ──
  function createEquation(math) {
    return {
      type: 'equation',
      math: math || '',
    };
  }

  // ── 6. Building the Hierarchy ──
  // Objects are connected using the content array:
  //   section.content.push(paragraph)
  //   section.content.push(subsection)
  //   paper.content.push(section)

  /**
   * Build a full Paper tree from a raw JSON object (paper.json format).
   * Walks the nested structure and creates proper typed objects.
   */
  function buildTree(raw) {
    if (!raw || typeof raw !== 'object') return createPaper();

    const paper = createPaper(
      raw.title,
      (raw.authors || []).map(function (a) {
        if (typeof a === 'string') return { name: a };
        return { name: a.name || '', affiliation: a.affiliation || '', email: a.email || '' };
      }),
      raw.abstract
    );

    // Walk content array and build the tree
    if (Array.isArray(raw.content)) {
      raw.content.forEach(function (item) {
        if (item.type === 'section') {
          var section = createSection(item.title);
          _buildChildren(item.content, section);
          paper.content.push(section);
        }
      });
    }

    // Copy references
    if (Array.isArray(raw.references)) {
      paper.references = raw.references.map(function (r) {
        return { id: r.id || '', citation: r.citation || '' };
      });
    }

    return paper;
  }

  /**
   * Recursively build children from a content array into a parent node.
   */
  function _buildChildren(items, parent) {
    if (!Array.isArray(items)) return;

    items.forEach(function (item) {
      switch (item.type) {
        case 'paragraph':
          parent.content.push(createParagraph(item.text));
          break;
        case 'equation':
          parent.content.push(createEquation(item.math));
          break;
        case 'subsection':
          var sub = createSubsection(item.title);
          _buildChildren(item.content, sub);
          parent.content.push(sub);
          break;
        case 'subsubsection':
          var subsub = createSubsubsection(item.title);
          _buildChildren(item.content, subsub);
          parent.content.push(subsub);
          break;
        case 'image':
          parent.content.push({
            type: 'image',
            src: item.src || '',
            caption: item.caption || '',
            width: item.width || '',
          });
          break;
        case 'table':
          parent.content.push({
            type: 'table',
            columns: item.columns || 0,
            caption: item.caption || '',
            headers: item.headers || [],
            data: item.data || [],
          });
          break;
        default:
          // Unknown type — keep as-is
          parent.content.push(item);
      }
    });
  }

  /**
   * Convert the flat PaperDoc format (used by editor state) back into
   * the nested tree format (paper.json / schema format).
   *
   * PaperDoc has: sections[{name, content(string), subsections[{name, content, subsubsections}]}]
   * Tree has:     content[{type:"section", title, content:[{type:"paragraph"}, {type:"subsection",...}]}]
   */
  function flatToTree(doc) {
    var paper = createPaper(
      doc.title,
      (doc.authors || []).map(function (a) {
        return { name: a.name || '', affiliation: a.affiliation || '', email: a.email || '' };
      }),
      doc.abstract
    );

    (doc.sections || []).forEach(function (sec) {
      var section = createSection(sec.name);

      // Section body text → paragraph(s)
      if (sec.content) {
        _textToParagraphs(sec.content).forEach(function (p) {
          section.content.push(p);
        });
      }

      // Subsections
      (sec.subsections || []).forEach(function (sub) {
        var subsection = createSubsection(sub.name);

        if (sub.content) {
          _textToParagraphs(sub.content).forEach(function (p) {
            subsection.content.push(p);
          });
        }

        // Subsubsections
        (sub.subsubsections || []).forEach(function (subsub) {
          var subsubsection = createSubsubsection(subsub.name);
          if (subsub.content) {
            _textToParagraphs(subsub.content).forEach(function (p) {
              subsubsection.content.push(p);
            });
          }
          subsection.content.push(subsubsection);
        });

        section.content.push(subsection);
      });

      paper.content.push(section);
    });

    // Tables as standalone items (attach to relevant section if sectionId matches)
    (doc.tables || []).forEach(function (t) {
      var target = _findSectionById(paper, t.sectionId);
      if (target) {
        target.content.push({
          type: 'table',
          columns: (t.headers || []).length,
          caption: t.caption || '',
          headers: t.headers || [],
          data: t.rows || [],
        });
      }
    });

    // Images
    (doc.images || []).forEach(function (img) {
      var target = _findSectionById(paper, img.sectionId);
      if (target) {
        target.content.push({
          type: 'image',
          src: img.url || '',
          caption: img.caption || '',
        });
      }
    });

    // References
    paper.references = (doc.references || []).map(function (r) {
      return { id: r.id || '', citation: r.citation || '' };
    });

    return paper;
  }

  /**
   * Convert a nested tree (paper.json) to the flat PaperDoc format
   * used by the editor state. This is essentially what Parser.transformPaperJsonToDoc does.
   */
  function treeToFlat(tree) {
    return window.Parser.transformPaperJsonToDoc(tree);
  }

  // ── Helpers ──

  function _textToParagraphs(text) {
    if (!text) return [];
    return text.split(/\n\s*\n/).filter(Boolean).map(function (chunk) {
      return createParagraph(chunk.trim());
    });
  }

  function _findSectionById(paper, sectionId) {
    if (!sectionId) return null;
    for (var i = 0; i < paper.content.length; i++) {
      if (paper.content[i]._id === sectionId) return paper.content[i];
    }
    // Fallback: return last section or null
    return paper.content.length > 0 ? paper.content[paper.content.length - 1] : null;
  }

  /**
   * Print the tree structure for debugging (matches Project.md §7).
   * Returns a string like:
   *   Paper
   *    ├─ Title
   *    ├─ Authors
   *    ├─ Abstract
   *    └─ Content
   *         └─ Section
   *              ├─ Paragraph
   *              └─ Subsection
   */
  function printTree(paper) {
    var lines = [];
    lines.push('Paper');
    lines.push(' ├─ Title: ' + (paper.title || ''));
    lines.push(' ├─ Authors: ' + (paper.authors || []).map(function (a) { return a.name; }).join(', '));
    lines.push(' ├─ Abstract: ' + (paper.abstract || '').substring(0, 60) + '…');
    lines.push(' └─ Content');
    (paper.content || []).forEach(function (item, idx) {
      var isLast = idx === paper.content.length - 1;
      _printNode(item, lines, '      ', isLast);
    });
    return lines.join('\n');
  }

  function _printNode(node, lines, prefix, isLast) {
    var connector = isLast ? '└─ ' : '├─ ';
    var label = (node.type || 'unknown');
    if (node.title) label += ': ' + node.title;
    else if (node.text) label += ': ' + node.text.substring(0, 50);
    else if (node.math) label += ': ' + node.math.substring(0, 50);
    lines.push(prefix + connector + label);

    if (Array.isArray(node.content)) {
      var childPrefix = prefix + (isLast ? '   ' : '│  ');
      node.content.forEach(function (child, ci) {
        _printNode(child, lines, childPrefix, ci === node.content.length - 1);
      });
    }
  }

  // ── Export ──
  window.DocumentModel = {
    createPaper: createPaper,
    createSection: createSection,
    createSubsection: createSubsection,
    createSubsubsection: createSubsubsection,
    createParagraph: createParagraph,
    createEquation: createEquation,
    buildTree: buildTree,
    flatToTree: flatToTree,
    treeToFlat: treeToFlat,
    printTree: printTree,
  };
})();
