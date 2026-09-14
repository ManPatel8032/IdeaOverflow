// ═══════════════════════════════════════════
//  Base Layout — Single-Column Template
//  Styled sections, subsections, abstract, authors, equations
// ═══════════════════════════════════════════

#let render(data) = {
  // ── Document settings ──
  set document(title: data.title, author: data.authors.map(a => a.name))
  set page(paper: "a4", margin: 1in)
  set text(font: "New Computer Modern", size: 11pt)
  set par(justify: true, leading: 0.6em)
  set heading(numbering: "1.1.")
  set math.equation(numbering: "(1)")

  // ── Section heading styles ──
  show heading.where(level: 1): it => {
    v(1.2em)
    text(weight: "bold", size: 14pt, fill: rgb("#1a1a2e"), it)
    v(0.5em)
    line(length: 100%, stroke: 0.5pt + rgb("#cccccc"))
    v(0.3em)
  }

  show heading.where(level: 2): it => {
    v(0.8em)
    text(weight: "bold", style: "italic", size: 12pt, fill: rgb("#2d3436"), it)
    v(0.4em)
  }

  show heading.where(level: 3): it => {
    v(0.5em)
    text(style: "italic", size: 11pt, fill: rgb("#555555"), it)
    v(0.3em)
  }

  // ── Citation reference helper ──
  let process-text(text-str) = {
    let resolved-str = text-str
    if "references" in data {
      let i = 1
      for ref in data.references {
        resolved-str = resolved-str.replace("@" + ref.id, str(i))
        i += 1
      }
    }
    eval(resolved-str, mode: "markup")
  }

  // ═══ TITLE — centered, bold, large ═══
  align(center)[
    #block(text(weight: "bold", size: 18pt, fill: rgb("#1a1a2e"), eval(data.title, mode: "markup")))
    #v(1.2em)

    // ═══ AUTHORS — names + affiliations styled ═══
    #grid(
      columns: calc.min(data.authors.len(), 3),
      gutter: 2em,
      ..data.authors.map(a => align(center)[
        #text(weight: "bold", size: 11pt)[#eval(a.name, mode: "markup")] \
        #text(style: "italic", size: 9.5pt, fill: rgb("#555555"))[#eval(a.affiliation, mode: "markup")]
      ])
    )
  ]
  v(1.5em)

  // ═══ ABSTRACT — styled block with label ═══
  if "abstract" in data and data.abstract != "" {
    block(
      width: 100%,
      inset: (x: 2em, y: 1em),
      fill: rgb("#f8f9fa"),
      radius: 4pt,
      stroke: 0.5pt + rgb("#dee2e6"),
    )[
      #text(weight: "bold", size: 10pt, fill: rgb("#1a1a2e"))[Abstract] \
      #v(0.3em)
      #text(style: "italic", size: 10pt)[#eval(data.abstract, mode: "markup")]
    ]
    v(1em)
  }

  // ═══ INDEX TERMS ═══
  if "index-terms" in data {
    block(inset: (x: 2em))[
      #text(weight: "bold", size: 9pt)[Index Terms — ]
      #text(size: 9pt, style: "italic")[#data.index-terms.join(", ")]
    ]
    v(1em)
  }

  // ═══ Recursive block renderer ═══
  let render-blocks(blocks) = {
    for item in blocks {
      if item.type == "section" {
        heading(level: 1)[#eval(item.title, mode: "markup")]
        if "content" in item { render-blocks(item.content) }

      } else if item.type == "subsection" {
        heading(level: 2)[#eval(item.title, mode: "markup")]
        if "content" in item { render-blocks(item.content) }

      } else if item.type == "subsubsection" {
        heading(level: 3)[#eval(item.title, mode: "markup")]
        if "content" in item { render-blocks(item.content) }

      } else if item.type == "paragraph" {
        // Paragraphs — normal text with processed citations
        par[#process-text(item.text)]

      } else if item.type == "equation" {
        // Equations — centered, numbered, with spacing
        v(0.4em)
        math.equation(block: true, eval(item.math, mode: "math"))
        v(0.4em)

      } else if item.type == "image" {
        let img-width = auto
        if "width" in item { img-width = eval(item.width) }
        let img-caption = none
        if "caption" in item { img-caption = eval(item.caption, mode: "markup") }
        figure(image(item.src, width: img-width), caption: img-caption)

      } else if item.type == "table" {
        let table-cells = ()
        if "headers" in item {
          for h in item.headers {
            table-cells.push([*#eval(h, mode: "markup")*])
          }
        }
        if "data" in item {
          for row in item.data {
            for cell in row { table-cells.push(eval(cell, mode: "markup")) }
          }
        }
        let t = table(
          columns: item.columns,
          align: center + horizon,
          fill: (_, row) => if row == 0 { rgb("#eef2f7") } else { none },
          ..table-cells,
        )
        if "caption" in item {
          figure(t, caption: eval(item.caption, mode: "markup"), kind: table)
        } else { t }
      }
    }
  }

  if "content" in data {
    render-blocks(data.content)
  }

  // ═══ REFERENCES — styled section ═══
  if "references" in data and data.references.len() > 0 {
    v(2em)
    line(length: 100%, stroke: 0.5pt + rgb("#cccccc"))
    v(0.5em)
    heading(level: 1, numbering: none)[References]

    set text(size: 9pt)
    let i = 1
    for ref in data.references {
      block(inset: (left: 1.5em, y: 0.15em))[
        #text(weight: "bold")[[#i]] #eval(ref.citation, mode: "markup")
      ]
      i += 1
    }
  }
}
