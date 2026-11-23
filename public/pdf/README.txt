PDF worksheets on the class whiteboard (src/components/classroom/live/pdfPages.ts): the PDF is opened and its
pages are drawn in the tutor's browser; each page then goes to the server like any whiteboard picture (read
for contact details before anyone sees it).

6.5.438/
  pdf.js 6.5.438 by Mozilla (https://github.com/mozilla/pdf.js), files from the pdfjs-dist package, unchanged:
    pdf.worker.min.mjs   legacy/build/pdf.worker.min.mjs
    standard_fonts/      the standard PDF fonts (Foxit and Liberation fonts; their licences are in the folder)
    cmaps/               character maps (Asian scripts)
    iccs/                colour profiles
    wasm/                decoders for scanned pages (OpenJPEG, JBIG2) and colour management (QCMS), with licences
  pdf.js: Apache License 2.0 (LICENSE in the folder, https://www.apache.org/licenses/LICENSE-2.0).
  The folder must match the pdfjs-dist version in package.json; a new version gets a new folder (cached for a year).
