// ═══════════════════════════════════════════
//  Base Layout — Double-Column Template
//  (Matches typst/double-column.pdf style)
// ═══════════════════════════════════════════

#let render(data) = {
  // Document settings
  set document(title: data.title, author: data.authors.map(a => a.name))
  set page(paper: "a4", margin: 1in)
  set text(font: "New Computer Modern", size: 10pt)
  set par(justify: true, leading: 0.55em)
  set heading(numbering: "1.1.")
  set math.equation(numbering: "(1)")

  // Helper: resolve @IDs → numbers, then evaluate markup
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

  // Title and authors (spans both columns)
  align(center)[
    #block(text(weight: "bold", size: 17pt, eval(data.title, mode: "markup")))
    #v(1em)
    #grid(
      columns: calc.min(data.authors.len(), 3),
      gutter: 2em,
      ..data.authors.map(a => align(center)[
        *#eval(a.name, mode: "markup")* \
        _#eval(a.affiliation, mode: "markup")_
      ])
    )
  ]
  v(2em)

  // Abstract (spans full width, before columns)
  if "abstract" in data and data.abstract != "" {
    block(
      width: 100%,
      inset: (x: 2em, y: 1em),
      fill: rgb("#f8f9fa"),
      radius: 4pt,
      stroke: 0.5pt + rgb("#dee2e6"),
    )[
      #text(weight: "bold", size: 10pt)[Abstract] \
      #v(0.3em)
      #text(style: "italic", size: 10pt)[#eval(data.abstract, mode: "markup")]
    ]
    v(0.5em)
  }

  // Index Terms
  if "index-terms" in data {
    block(inset: (x: 2em))[
      #text(weight: "bold", size: 9pt)[Index Terms — ]
      #text(size: 9pt, style: "italic")[#data.index-terms.join(", ")]
    ]
    v(0.5em)
  }

  // Start two-column layout for the body
  show: columns.with(2, gutter: 1.5em)

  // Recursive renderer
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
        process-text(item.text)
      } else if item.type == "equation" {
        math.equation(block: true, eval(item.math, mode: "math"))
      } else if item.type == "image" {
        let img-width = auto
        if "width" in item { img-width = eval(item.width) }
        let img-caption = none
        if "caption" in item { img-caption = eval(item.caption, mode: "markup") }
        figure(image(item.src, width: img-width), caption: img-caption)
      } else if item.type == "table" {
        let table-cells = ()
        if "headers" in item {
          for h in item.headers { table-cells.push([*#eval(h, mode: "markup")*]) }
        }
        if "data" in item {
          for row in item.data {
            for cell in row { table-cells.push(eval(cell, mode: "markup")) }
          }
        }
        let t = table(columns: item.columns, align: center + horizon, ..table-cells)
        if "caption" in item {
          figure(t, caption: eval(item.caption, mode: "markup"), kind: table)
        } else { t }
      }
    }
  }

  if "content" in data {
    render-blocks(data.content)
  }

  // References
  if "references" in data and data.references.len() > 0 {
    v(1.5em)
    heading(level: 1, numbering: none)[References]

    let i = 1
    for ref in data.references {
      block[
        [#i] #eval(ref.citation, mode: "markup")
      ]
      i += 1
    }
  }
}

