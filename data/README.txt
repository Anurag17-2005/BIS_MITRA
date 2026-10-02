⭐ BIS MITRA DEMO DATA
Synthetic demonstration records - NOT official BIS data.

BIS MITRA STANDARDS DOMAIN - DEMO DATASET README
================================================

PURPOSE
-------
This package contains synthetic, fictional BIS-like Standards records for demonstrating the BIS MITRA retrieval experience. It is designed so a user can ask a standards question, retrieve a record, cite a demo_id, and open the corresponding demo source file.

IMPORTANT NOTICE
----------------
All identifiers, titles, dates, QCO references, requirements, amendment details, and historical relationships in this package are fictional and created only for demonstration. They are NOT official BIS records and must not be presented as real BIS standards.

RECORD COUNT
------------
14 synthetic standards.

FILES
-----
1. standards.pdf
   Human-readable BIS-style demo catalog with a summary table, detailed standard records, amendment details, testing/certification information, and historical relationships.

2. standards.csv
   One row per standard. List-like fields use " | " separators and relational fields use semicolon-delimited demo_ids/terms. Amendment fields are flattened into dedicated columns.

3. standards.json
   Complete nested representation with arrays for requirements, tests, evidence, synonyms, related standards, and nested amendment objects.

4. standards.html
   Searchable/table-based demo webpage with client-side search and sector/status filters; each record expands to show detailed information.

5. README.txt
   This guide.

6. BIS_MITRA_STANDARDS_DEMO.zip
   ZIP package containing the five files above.

FIELD DEFINITIONS
-----------------
demo_id: Stable synthetic identifier used for agent citations, e.g. STD-DEMO-001.
standard_number: Fictional standard identifier. These are deliberately non-official demo numbers.
title: Fictional standard title.
sector / sub_sector: Demo classification for sector and narrower category searches.
standard_type: High-level document type used in retrieval/display.
edition_year: Fictional edition year.
status: Active or Superseded.
scope: What the standard covers and its intended subject.
applicability: Where the standard applies and important exclusions.
certification_applicability: Demo statement describing whether certification is applicable/required under an associated route.
qco_reference: Fictional QCO reference or blank when no QCO is attached in the demo dataset.
key_requirements: Main technical/product requirements.
testing_requirements: Tests associated with the standard.
lab_evidence: Example laboratory/test evidence that MITRA can surface in follow-up answers.
marking_requirements: Product marking/identification requirements.
documentation_required: Typical evidence/documents needed for a demo conformity workflow.
published_date: Synthetic publication date.
effective_date: Synthetic date on which the record is treated as effective in the demo.
last_reviewed: Synthetic latest review date.
amendment_status: "Amended" or "No amendment".
amendment_reference: Synthetic amendment identifier when an amendment exists.
amendment object/columns: Amendment number, date, affected clause, previous requirement, revised requirement, reason, and amendment effective date.
supersedes: demo_id of an older record replaced by this record, where applicable.
superseded_by: demo_id of the newer record that replaced this record, where applicable.
related_standards: Other synthetic standards that may be relevant for related-topic searches.
keywords: Retrieval-oriented topic terms.
synonyms: Alternative user phrasing; useful for non-exact title searches.
product_examples: Example products covered by the demo scope.
source_reference: Stable citation text for demo retrieval responses.
source_file: Demo source files containing the record.

SUPPORTED DEMO QUESTIONS
------------------------
- Find the standard for industrial safety helmets.
- What is the scope of this standard?
- Is this standard currently active?
- When was this standard published?
- When was it last reviewed?
- What are the main requirements?
- Is certification required/applicable?
- Which QCO is related to this standard?
- Show me standards related to electrical appliances.
- Show me standards related to food-contact materials.
- Which standards are superseded?
- What replaced the superseded standard?
- Does this standard have an amendment?
- What changed in the amendment?
- Find all standards in a particular sector.
- Compare two standards.
- What testing is associated with this standard?
- Which laboratory/test evidence would be relevant?
- Give me the standard number and title.
- What about its certification / last review / key tests / QCO?

HISTORICAL RELATIONSHIPS IN THIS DEMO
--------------------------------------
STD-DEMO-010 (superseded) -> replaced by STD-DEMO-011 (active)
STD-DEMO-012 (superseded) -> replaced by STD-DEMO-013 (active)

AMENDED RECORDS IN THIS DEMO
----------------------------
STD-DEMO-001 -> AMD-DEMO-1001-01
STD-DEMO-005 -> AMD-DEMO-1005-01

SOURCE-CITATION EXAMPLE
-----------------------
Source:
BIS MITRA Demo -> Standards -> STD-DEMO-001
File:
standards.pdf

DATA QUALITY CHECKS PERFORMED
-----------------------------
- Exactly 14 standards generated.
- Multiple sectors represented.
- Active and superseded status types present.
- Amended and non-amended records present.
- QCO references present on applicable demo records.
- Certification applicability present on every record.
- Testing and lab-evidence information present on every record.
- Synonyms and retrieval keywords present on every record.
- Two explicit supersession chains are internally consistent.
- CSV, JSON, PDF, and HTML are generated from the same in-memory source records.
- No official BIS standard numbers are intentionally used; all standard identifiers are synthetic "IS DEMO ..." records.
