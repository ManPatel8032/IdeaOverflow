

# Instructions for the Agent

The system receives a **paper JSON file** that follows the provided `paper-schema.json`.
This JSON represents the paper as a **nested document structure (AST)**.

The goal is to **convert this JSON into JavaScript objects and maintain the hierarchy between sections, subsections, paragraphs, and equations**.

We will represent the document as a **tree of objects**.

---

# 1. Paper Object (Root)

The paper object is the root of the structure.

It contains:

* title
* authors
* abstract
* content

The `content` array will contain all **top-level sections**.

Example:

```javascript
paper = {
  title: "...",
  authors: [],
  abstract: "...",
  content: []
}
```

---

# 2. Section Object

A section represents a main heading such as **Introduction, Methodology, Results, Conclusion**.

Each section must contain:

* `type: "section"`
* `title`
* `content` (array)

Example:

```javascript
section = {
  type: "section",
  title: "Introduction",
  content: []
}
```

The `content` array will contain:

* paragraphs
* subsections
* equations

---

# 3. Subsection Object

A subsection is nested inside a section.

Structure:

```javascript
subsection = {
  type: "subsection",
  title: "Mathematical Rendering",
  content: []
}
```

The subsection `content` array may contain:

* paragraphs
* equations

---

# 4. Paragraph Object

Paragraphs are **text blocks** inside sections or subsections.

Structure:

```javascript
paragraph = {
  type: "paragraph",
  text: "OCR systems are widely used..."
}
```

Paragraphs are added to the `content` array of a section or subsection.

---

# 5. Equation Object

Equations represent mathematical expressions.

Structure:

```javascript
equation = {
  type: "equation",
  math: "L(theta) = ..."
}
```

Equations can appear inside:

* sections
* subsections

---

# 6. Building the Hierarchy

Objects are connected using the `content` array.

Example workflow:

1. Create a section.
2. Create paragraphs.
3. Push paragraphs into the section.
4. Create a subsection.
5. Push paragraphs/equations into the subsection.
6. Push the subsection into the section.
7. Push the section into the paper.

Example logic:

```javascript
section.content.push(paragraph1)
section.content.push(paragraph2)

subsection.content.push(paragraph3)
subsection.content.push(equation)

section.content.push(subsection)

paper.content.push(section)
```

---

# 7. Final Tree Representation

After constructing the objects, the structure should look like this:

```
Paper
 ├─ Title
 ├─ Authors
 ├─ Abstract
 └─ Content
      └─ Section
           ├─ Paragraph
           ├─ Paragraph
           └─ Subsection
                ├─ Paragraph
                └─ Equation
```

---

# 8. Key Rule

The hierarchy must always follow this pattern:

```
Paper.content → contains sections
Section.content → contains paragraphs or subsections
Subsection.content → contains paragraphs or equations
```

Objects must always be appended using:

```
.content.push()
```

This ensures the nested structure remains consistent with the JSON schema.

---

# 9. Expected Result

After parsing the JSON and building the objects, the internal structure should match the nested format defined in the schema. The system can then use this structure later for **rendering or formatting**.

---


