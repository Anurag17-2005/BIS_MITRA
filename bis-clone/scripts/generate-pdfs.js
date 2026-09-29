import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filesDir = path.join(__dirname, '..', 'public', 'files');

const pdfs = {
  'manuals/IS-4151-2015.pdf': `IS 4151:2015 - PROTECTIVE HELMET FOR TWO WHEELER RIDERS

SCOPE: This standard specifies requirements for protective helmets for two wheeler riders.

CLAUSE 5.1 - IMPACT ABSORPTION
Minimum impact absorption: 400g peak acceleration.

CLAUSE 7.2 - RETENTION SYSTEM
The chin strap shall withstand a force of 150 kgf without failure.

TABLE 1 - IMPACT TEST REQUIREMENTS
Test Point | Energy (J) | Max Acceleration (g)
Crown     | 49         | 400
Front     | 49         | 400
Side      | 49         | 400

MARKING: Each helmet shall bear the Standard Mark and IS 4151:2015.`,
  'manuals/IS-623-2025.pdf': `IS 623:2025 - BICYCLES - BICYCLE FRAMES - SPECIFICATION

SCOPE: This standard covers requirements for bicycle frames.

CLAUSE 4.1 - MATERIAL
Frames shall be made of steel, aluminium alloy, or carbon fibre composite.

CLAUSE 6.3 - FATIGUE TEST
Frame shall withstand 100,000 cycles at 1200 N load without crack.

TABLE 2 - FRAME DIMENSION TOLERANCES
Parameter      | Tolerance (mm)
Head tube angle| ±0.5
Seat tube angle| ±0.5
Chain stay     | ±1.0`,
  'manuals/IS-3055-1994.pdf': `IS 3055 (Part 1):1994 - Clinical Thermometers – Solid stem Type

SCOPE: Requirements for solid stem clinical thermometers.

CLAUSE 3.2 - ACCURACY
Maximum permissible error: ±0.2°C in range 35°C to 42°C.

TABLE 3 - THERMOMETER TOLERANCES
Temperature Range | Permissible Error
35°C - 42°C      | ±0.2°C
Below 35°C       | ±0.3°C

MARKING: Each thermometer shall bear IS 3055 (Part 1):1994.`,
  'manuals/IS-170-2020.pdf': `IS 170:2020 - ACETONE - Specification (Representative excerpt for prototype).`,
  'manuals/IS-1-1968.pdf': `IS 1:1968 - National Flag Specification (Representative excerpt for prototype).`,
  'process/certification-process-guidelines.pdf': `BIS Scheme-I - Guidelines for Grant of Licence

STEP 1: Submit application online via Manak Online portal.
STEP 2: Document verification by BIS officer.
STEP 3: Factory inspection and sample testing.
STEP 4: Grant of licence upon satisfactory compliance.

Required documents: Application form, test report, factory layout, quality control plan.`,
  'process/scheme-1-additional.pdf': `Additional Guidelines for Scheme-I - Product certification supplementary requirements.`,
  'process/non-conformity-guidelines.pdf': `Guidelines for Dealing With Product Non-Conformity under BIS Conformity Assessment.

1. Classification of non-conformities (critical / major / minor).
2. Containment and root-cause analysis.
3. Corrective action and verification by BIS officer.
4. Records to be retained at the factory for audit.

This prototype PDF is longer so the admin warehouse viewer has readable pages.`,
};

function createMinimalPdf(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = text.split('\n').slice(0, 80);
  let stream = 'BT\n/F1 10 Tf\n50 750 Td\n14 TL\n';
  lines.forEach((line, i) => {
    const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (i === 0) stream += `(${safe}) Tj\n`;
    else stream += `T*\n(${safe}) Tj\n`;
  });
  stream += 'ET';
  const streamLen = Buffer.byteLength(stream);
  return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length ${streamLen}>>stream
${stream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000344 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
${400 + streamLen}
%%EOF`;
}

for (const [relPath, content] of Object.entries(pdfs)) {
  const fullPath = path.join(filesDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, createMinimalPdf(content));
  console.log(`Created ${relPath}`);
}

console.log('PDFs generated.');
