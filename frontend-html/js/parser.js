/* ═══════════════════════════════════════════
   Document Parser & Transformer
   Converts raw paper.json → internal PaperDoc
   ═══════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   Section A: Tree Builder (Project.md spec)
   Converts paper JSON → nested JS object tree

   Hierarchy rules:
     Paper.content       → contains Sections
     Section.content     → contains Paragraphs, Subsections, Equations
     Subsection.content  → contains Paragraphs, Equations
   ───────────────────────────────────────────── */

/**
 * Build a Paper tree from the raw JSON.
 *
 * Input : a paper JSON object that follows the nested AST format
 *         (with typed nodes: section, subsection, paragraph, equation).
 *
 * Output: a Paper root object whose `content` array holds the
 *         full hierarchy of Section → Subsection → Paragraph / Equation
 *         objects connected via their own `content` arrays.
 *
 * Usage:
 *   const paper = buildPaperTree(rawJson);
 *   // paper.content[0]              → first Section
 *   // paper.content[0].content[0]   → first child (Paragraph / Subsection / Equation)
 */
function buildPaperTree(raw) {
    // 1. Create root Paper object
    const paper = {
        title:    raw.title    || '',
        authors:  Array.isArray(raw.authors) ? raw.authors.map(a => ({ ...a })) : [],
        abstract: raw.abstract || '',
        content:  []           // will hold top-level Section objects
    };

    // Walk the raw content array and build the tree
    const rawContent = raw.content || raw.sections || [];
    for (const item of rawContent) {
        const node = _buildNode(item);
        if (node) {
            paper.content.push(node);
        }
    }

    return paper;
}

/**
 * Recursively build a single node and its children.
 * Returns a typed JS object (section / subsection / paragraph / equation)
 * with a `content` array where applicable.
 */
function _buildNode(item) {
    if (!item || typeof item !== 'object') return null;

    // Determine the node type
    const type = item.type || _inferType(item);

    switch (type) {
        case 'section': {
            const section = {
                type:    'section',
                title:   item.title || item.heading || '',
                content: []
            };
            // Recursively process children
            const children = item.content || [];
            if (typeof children === 'string') {
                // Flat schema: content is a plain string → wrap as paragraph
                section.content.push({ type: 'paragraph', text: children });
            } else if (Array.isArray(children)) {
                for (const child of children) {
                    const childNode = _buildNode(child);
                    if (childNode) section.content.push(childNode);
                }
            }
            return section;
        }

        case 'subsection':
        case 'subsubsection': {
            const subsection = {
                type:    'subsection',
                title:   item.title || '',
                content: []
            };
            const children = item.content || [];
            if (Array.isArray(children)) {
                for (const child of children) {
                    const childNode = _buildNode(child);
                    if (childNode) subsection.content.push(childNode);
                }
            }
            return subsection;
        }

        case 'paragraph': {
            return {
                type: 'paragraph',
                text: item.text || ''
            };
        }

        case 'equation': {
            return {
                type: 'equation',
                math: item.math || ''
            };
        }

        // Pass through table/image nodes unchanged
        case 'table':
        case 'image':
            return { ...item };

        default:
            return null;
    }
}

/**
 * Infer the type for items that come from the flat paper-schema.json
 * format (which uses `heading` + `content` instead of `type`).
 */
function _inferType(item) {
    if (item.heading && item.content !== undefined) return 'section';
    if (item.text   !== undefined)                  return 'paragraph';
    if (item.math   !== undefined)                  return 'equation';
    return 'unknown';
}

/**
 * Pretty-print the paper tree to the console (for debugging).
 *
 *   printTree(paper)
 *   →  Paper
 *       ├─ Title: "..."
 *       ├─ Authors: [...]
 *       ├─ Abstract: "..."
 *       └─ Content
 *            └─ Section: Introduction
 *                 ├─ Paragraph: "OCR systems..."
 *                 └─ Subsection: Math Rendering
 *                      ├─ Paragraph: "We define..."
 *                      └─ Equation: "L(theta)=..."
 */
function printTree(paper) {
    const lines = [];
    lines.push('Paper');
    lines.push(' ├─ Title: "' + paper.title + '"');
    lines.push(' ├─ Authors: [' + paper.authors.map(a => a.name).join(', ') + ']');
    lines.push(' ├─ Abstract: "' + (paper.abstract || '').slice(0, 60) + (paper.abstract && paper.abstract.length > 60 ? '…' : '') + '"');
    lines.push(' └─ Content');

    function walk(nodes, prefix) {
        nodes.forEach((node, i) => {
            const isLast = i === nodes.length - 1;
            const connector = isLast ? '└─' : '├─';
            const childPrefix = prefix + (isLast ? '   ' : '│  ');

            if (node.type === 'section' || node.type === 'subsection') {
                lines.push(prefix + connector + ' ' + capitalize(node.type) + ': ' + node.title);
                if (node.content && node.content.length > 0) {
                    walk(node.content, childPrefix);
                }
            } else if (node.type === 'paragraph') {
                const preview = (node.text || '').slice(0, 50) + ((node.text || '').length > 50 ? '…' : '');
                lines.push(prefix + connector + ' Paragraph: "' + preview + '"');
            } else if (node.type === 'equation') {
                lines.push(prefix + connector + ' Equation: ' + (node.math || ''));
            } else {
                lines.push(prefix + connector + ' ' + capitalize(node.type || 'unknown'));
            }
        });
    }

    if (paper.content && paper.content.length > 0) {
        walk(paper.content, '      ');
    }

    console.log(lines.join('\n'));
    return lines.join('\n');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ─────────────────────────────────────────────
   Section B: Flat PaperDoc transformer
   (existing code — used by the editor UI)
   ───────────────────────────────────────────── */

/**
 * Collect paragraph/equation text from a content array
 * (stops when it hits sections/subsections).
 */
function collectParagraphs(items) {
    const parts = [];
    for (const item of items) {
        if (item.type === 'paragraph' && item.text) parts.push(item.text);
        else if (item.type === 'equation' && item.math) parts.push(`$${item.math}$`);
        else if (['section', 'subsection', 'subsubsection'].includes(item.type)) break;
    }
    return parts.join('\n\n');
}

function _uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Transform the nested paper.json structure into a flat PaperDoc.
 */
function transformPaperJsonToDoc(raw) {
    const now = Date.now();
    const sections = [];
    const tables = [];
    const images = [];
    const references = Array.isArray(raw.references)
        ? raw.references.map(r => ({ id: r.id, citation: r.citation }))
        : [];
    let abstract = raw.abstract || '';

    function processNested(items, parentId, isSub) {
        for (const item of items) {
            if ((item.type === 'subsection' || item.type === 'subsubsection') && !isSub) {
                const sec = sections.find(s => s.id === parentId);
                if (sec) {
                    sec.subsections.push({
                        id: _uid('sub'),
                        name: item.title || 'Untitled',
                        content: item.content ? collectParagraphs(item.content) : '',
                    });
                }
            } else if (item.type === 'table') {
                tables.push({
                    id: _uid('table'),
                    caption: item.caption,
                    headers: item.headers || [],
                    rows: item.data || [],
                    sectionId: parentId,
                });
            } else if (item.type === 'image') {
                images.push({
                    id: _uid('img'),
                    url: item.src || '',
                    caption: item.caption,
                    sectionId: parentId,
                });
            }
            if (item.content) processNested(item.content, parentId, (item.type || '').includes('section'));
        }
    }

    for (const item of (raw.content || [])) {
        if (item.type === 'section') {
            const id = _uid('sec');
            sections.push({
                id,
                name: item.title || 'Untitled',
                content: item.content ? collectParagraphs(item.content) : '',
                subsections: [],
            });
            if (item.content) processNested(item.content, id);
        } else if (item.type === 'paragraph' && item.text && sections.length === 0) {
            abstract += (abstract ? '\n\n' : '') + item.text;
        }
    }

    return {
        title: raw.title || 'Untitled',
        authors: (raw.authors || []).map(a => ({ name: a.name, affiliation: a.affiliation, email: a.email })),
        abstract,
        sections,
        tables,
        images,
        references,
        updatedAt: now,
    };
}

/**
 * Safely coerce any unknown input into a valid PaperDoc.
 */
function coerceDoc(input) {
    const now = Date.now();
    if (!input || typeof input !== 'object') {
        return { ...getDefaultDoc(), updatedAt: now };
    }
    return {
        title: typeof input.title === 'string' ? input.title : 'Paper Title',
        abstract: typeof input.abstract === 'string' ? input.abstract : '',
        authors: Array.isArray(input.authors) ? input.authors : [],
        sections: Array.isArray(input.sections) ? input.sections : [],
        tables: Array.isArray(input.tables) ? input.tables : [],
        images: Array.isArray(input.images) ? input.images : [],
        references: Array.isArray(input.references) ? input.references : [],
        updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : now,
    };
}

function getDefaultDoc() {
    return {
        title: 'Paper Title',
        authors: [
            { name: 'Author 1', affiliation: 'University / Organization', email: 'author1@example.com' },
            { name: 'Author 2', affiliation: 'University / Organization', email: 'author2@example.com' },
        ],
        abstract: 'Write your abstract here. This preview updates instantly as you add sections, subsections, tables, and images.',
        sections: [
            { id: 'sec-intro', name: 'Introduction', content: 'Introduce the problem, context, and motivation.', subsections: [] },
        ],
        tables: [],
        images: [],
        references: [],
        updatedAt: Date.now(),
    };
}

/* ─── Export all functions ─── */
window.Parser = {
    buildPaperTree,
    printTree,
    transformPaperJsonToDoc,
    flatToTree: function (doc) {
        return window.DocumentModel ? window.DocumentModel.flatToTree(doc) : buildPaperTree(doc);
    },
    coerceDoc,
    getDefaultDoc,
};
