import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfDir = path.join(__dirname, '..', 'data', 'knowledge', 'pdfs', 'schemes');

// Ensure directory exists
fs.mkdirSync(pdfDir, { recursive: true });

const fmcsDocuments = {
  'fmcs-scheme-notification-2018.pdf': `BUREAU OF INDIAN STANDARDS
FOREIGN MANUFACTURERS CERTIFICATION SCHEME (FMCS)
Notification No. BIS/FMCS/2018/001

SCOPE AND APPLICABILITY

The Foreign Manufacturers Certification Scheme (FMCS) enables manufacturers located outside India 
to apply for and obtain a BIS certification mark (Standard Mark or ISI mark) for products 
intended for sale in India without establishing a presence in India.

LEGAL AUTHORITY: Bureau of Indian Standards Act, 2016, Section 14(1)(d).

MANDATORY PRODUCTS UNDER FMCS

Products under Quality Control Orders (QCOs) manufactured abroad require FMCS license before 
customs clearance. Key categories include:

1. AUTOMOTIVE ELECTRONICS
   - Engine Control Units (ECU): IS 16046 (Part 2):2018 | HS Code 8542.31
   - Electronic Fuel Injection Systems: IS 16046 | HS Code 8542.31

2. ELECTRONICS & IT EQUIPMENT  
   - LED Lamps and Light-Emitting Diodes: IS 15844:2010 | HS Code 8541.40
   - Portable IT Equipment: IS 13252 (Part 1):2010 | HS Code 8471.30
   - Smartphones: IS 13252 (Part 1):2010 | HS Code 8517.13
   - Power Inverters: IS 13252 (Part 1):2010 | HS Code 8504.40.90

3. ELECTRICAL APPLIANCES
   - Electric Water Heaters (Geysers): IS 2082:2018 | HS Code 8516.10

4. METALS & CONSTRUCTION
   - Hot-Rolled Structural Steel: IS 2062:2011 | HS Code 7216.10

5. SAFETY EQUIPMENT
   - Two-Wheeler Helmets: IS 4151:2015 | HS Code 6506.10
   - Bicycle Frames: IS 623:2025 | HS Code 8714.91

6. PLUMBING & VALVES
   - Pressure Relief Valves: IS 778:2019 | HS Code 8481.80

7. MEDICAL DEVICES
   - Clinical Thermometers: IS 3055 (Part 1):1994 | HS Code 9018.19

SCHEME TYPES

SCHEME-I (FMCS): Product Certification with factory inspection. ISI Mark granted.
SCHEME-II (CRS): Compulsory Registration Scheme. Simplified procedure for electronics.

APPLICATION FEES (2026 Schedule)

Application Fee (non-refundable): ₹30,000
Processing Fee: ₹15,000 for CRS | ₹30,000 for FMCS Scheme-I
Marking Fee: Variable by IS standard and enterprise type (see fee matrix)
BIS Officer Travel: Reimbursable actual costs (see zone-wise schedule)

PROCESSING TIMELINE

CRS (Scheme-II): 12-16 weeks
FMCS Scheme-I: 16-24 weeks (depends on travel zone and lab queue)

EFFECTIVE DATE: January 1, 2018
AMENDED: March 15, 2024 (Zone Americas travel fee revision)

Contact: FMCS Cell, Bureau of Indian Standards
Address: Manak Bhavan, 9 Bahadur Shah Zafar Marg, New Delhi - 110002
Email: fmcs@bis.gov.in | Phone: +91-11-2323-0131`,

  'fmcs-application-form-iv.pdf': `BUREAU OF INDIAN STANDARDS
FMCS APPLICATION — FORM-IV

APPLICATION FOR FOREIGN MANUFACTURERS CERTIFICATION SCHEME (FMCS)

SECTION A: MANUFACTURER DETAILS

1. Company Name (as per incorporation): _________________________________
2. Country of Incorporation: _________________________________
3. Factory Address (where product is manufactured): 
   _________________________________________________________________
   _________________________________________________________________

4. Factory Registration Number: _________________________________
5. Year of Establishment: _________________________________

SECTION B: AUTHORIZED INDIAN REPRESENTATIVE (AIR)

Under BIS FMCS Rules, every foreign applicant must appoint an Authorized Indian Representative 
(AIR) who is an Indian citizen or Indian registered entity.

6. AIR Full Name: _________________________________
7. AIR Company Name (if entity): _________________________________
8. AIR Address in India:
   _________________________________________________________________
   _________________________________________________________________
9. AIR PAN Number: _________________________________
10. AIR Email: _________________________________
11. AIR Phone: _________________________________

SECTION C: PRODUCT DETAILS

12. Product Name: _________________________________
13. IS Standard Number: _________________________________
14. HS Code (for customs): _________________________________
15. Product Category: _________________________________

16. Annual Production Capacity: _________________________________
17. Intended India Market Segment: _________________________________

SECTION D: QUALITY ASSURANCE

18. Quality Management System: ☐ ISO 9001  ☐ Other: _____________
19. Accreditation Body: _________________________________
20. Valid Until: _________________________________

SECTION E: TESTING DOCUMENTATION

21. Foreign Test Report Reference: _________________________________
22. Testing Laboratory Name: _________________________________
23. Lab Accreditation: ☐ ILAC  ☐ ISO 17025  ☐ Other: _____________

SECTION F: MRA / TRADE AGREEMENT ELIGIBILITY

24. Does your country have an active MRA/CEPA/FTA with India for this product category?
    ☐ Yes (specify): _________________________________
    ☐ No

If Yes, you may be eligible for testing waiver. Attach treaty certificate.

SECTION G: DECLARATION

I/We declare that the information provided is true and accurate. I/We authorize the appointed 
AIR to act on our behalf for all BIS communications.

Signature: _________________________  Date: _________________________
Name & Designation: _________________________________________________
Company Seal: ___________

DOCUMENTS TO ATTACH:
1. Factory registration certificate (notarized + apostilled)
2. AIR nomination letter (Form-VI Power of Attorney)
3. Foreign test report (if applicable)
4. Quality manual (ISO 9001 or equivalent)
5. Product technical specification sheet
6. Company profile and financial statements (last 2 years)
7. Demand draft for ₹30,000 (application fee) in favor of "Bureau of Indian Standards"

SUBMIT TO: FMCS Cell, BIS Head Office, New Delhi
OR Online: https://manakonline.in (FMCS portal)

Processing Time: 16-24 weeks from complete application receipt
Reference Number will be issued within 5 working days`,

  'fmcs-air-nomination-template.pdf': `BUREAU OF INDIAN STANDARDS
FORM-VI: AUTHORIZED INDIAN REPRESENTATIVE (AIR) NOMINATION
POWER OF ATTORNEY FOR FMCS

[Execute on Company Letterhead]

POWER OF ATTORNEY

I/We _________________________________ [Foreign Company Name], 
a company incorporated under the laws of _________________________________ [Country],
having our registered office at _____________________________________________
_______________________________________________________________________,

HEREBY APPOINT _________________________________ [Full Name of AIR],
an Indian citizen/entity, having address at ___________________________________
_______________________________________________________________________,
PAN Number: _______________, Aadhar/Entity Registration: _______________,

as our AUTHORIZED INDIAN REPRESENTATIVE (AIR) for all matters related to Bureau of 
Indian Standards (BIS) Foreign Manufacturers Certification Scheme (FMCS).

SCOPE OF AUTHORITY GRANTED:

The AIR is empowered to:

1. LICENSING AUTHORITY
   - Apply for and hold BIS FMCS licenses on our behalf under IS _____________ 
     [specify IS standard number]
   - Sign all FMCS application documents, amendments, and renewals
   - Pay marking fees and other statutory charges to BIS

2. LEGAL REPRESENTATION
   - Accept service of all legal notices, show-cause notices, and official communications 
     from BIS on our behalf in India
   - Respond to BIS queries, compliance notices, and enforcement actions
   - Represent us in all proceedings before BIS authorities

3. OPERATIONAL COORDINATION
   - Coordinate factory inspections by BIS officers at our overseas facility
   - Arrange logistics for BIS officer visits (visa invitation, accommodation, factory access)
   - Provide all requested documentation and records to BIS inspectors

4. QUALITY ASSURANCE
   - Ensure ongoing product quality compliance with IS _____________ for all products 
     sold in India under our brand
   - Maintain sample inventory for BIS market surveillance testing
   - Implement corrective actions for any non-conformance identified by BIS

5. COMPLIANCE LIABILITY
   - The AIR accepts full legal liability for product quality, safety, and conformance 
     to IS standards for products sold in India under our manufacturing
   - The AIR shall be the primary contact for consumer complaints, product recalls, 
     and enforcement actions in India

FINANCIAL RESPONSIBILITY:

We authorize the AIR to incur expenses related to BIS compliance activities and agree 
to reimburse such expenses within 30 days of invoicing.

DURATION:

This Power of Attorney shall remain valid until revoked in writing by either party. 
Any revocation must be notified to BIS FMCS Cell with 90 days advance notice.

GOVERNING LAW:

This agreement is governed by the laws of India. Any disputes shall be subject to 
the exclusive jurisdiction of courts in New Delhi.

EXECUTED ON: _______________ [Date]
AT: _______________ [City, Country]

_____________________________          _____________________________
Authorized Signatory                  AIR Signature (Acceptance)
[Name & Designation]                  [Name]
[Company Seal]

NOTARIZATION (Required):
Notarized by: _____________________________
Notary Public, [Country]: _____________________________
Seal: _______________

APOSTILLE (If Applicable):
For countries under Hague Convention, attach apostille certificate.

SUBMIT ORIGINAL TO:
FMCS Cell, Bureau of Indian Standards
Manak Bhavan, 9 Bahadur Shah Zafar Marg
New Delhi - 110002, India

Note: This Form-VI must accompany Form-IV (FMCS Application).`,

  'fmcs-fee-matrix-2026.pdf': `BUREAU OF INDIAN STANDARDS
FMCS FEE MATRIX — 2026 SCHEDULE

STATUTORY FEES (Non-Refundable)

Application Fee: ₹30,000 (all FMCS Scheme-I applications)
CRS Registration Fee: ₹14,500 (Scheme-II electronics)

MARKING FEES (Annual License)

Marking fees are charged based on:
- IS Standard
- Enterprise Type (Micro/Small/Large)
- Annual Turnover in India Market

Fee Structure by Enterprise Size:

MICRO & SMALL ENTERPRISES (Udyam-registered equivalent):
- Discount: 50% off standard marking fee
- Processing: Fast-track 4-week timeline

LARGE ENTERPRISES:
- Standard marking fee applies
- Processing: 8-week timeline

Sample Marking Fees (₹):
- IS 2082 (Geyser): ₹50,000 (large) | ₹25,000 (micro/small)
- IS 4151 (Helmet): ₹15,000 (large) | ₹7,500 (micro/small)
- IS 623 (Bicycle Frame): ₹20,000 (large) | ₹10,000 (micro/small)
- IS 16046 (ECU): ₹75,000 (large) | ₹37,500 (micro/small)

BIS OFFICER TRAVEL COSTS (Reimbursable Actual)

Factory audits for FMCS Scheme-I require BIS officer deputation to overseas factory.
Travel cost is borne by the applicant. Zone-wise estimates:

ZONE ASIA (Bangladesh, Sri Lanka, Nepal, China, Thailand, Malaysia, Singapore, Indonesia):
- Flight: Economy class (up to 6 hours)
- Per Diem: US$ 150/day
- Accommodation: 4-star hotel
- Duration: 3-5 working days
- ESTIMATED TOTAL: €800 or US$ 870

ZONE EUROPE (EU, UK, Switzerland, Germany, France, Italy, Spain, Poland, Czech Republic):
- Flight: Economy class (up to 12 hours) or Business class (>12 hours for senior officers)
- Per Diem: €200/day (Europe), £180/day (UK)
- Accommodation: 4-star or 5-star hotel
- Duration: 4-6 working days (including travel days)
- ESTIMATED TOTAL: €2,500 or US$ 2,720

ZONE AMERICAS (USA, Canada, Mexico, Brazil, Argentina):
- Flight: Business class (>14 hours for all grades)
- Per Diem: US$ 250/day
- Accommodation: 4-star hotel minimum
- Duration: 5-7 working days (long travel time + jet lag allowance)
- ESTIMATED TOTAL: €3,200 or US$ 3,200

AUDIT WAIVERS (MRA/CEPA/FTA)

Countries with active Mutual Recognition Agreements may receive:
- Testing Waiver: Foreign accredited lab reports accepted
- Audit Waiver: Factory audit exempted (CRS Scheme-II only)

Current Active Treaties (as of 2026):
- Germany: Testing waiver (DAkkS labs accepted)
- Japan: Testing + Audit waiver (JIS-certified products, CRS only)
- South Korea: Testing waiver (KC certification accepted)
- European Union: Testing waiver (CE-marked products, supporting docs required)
- United Kingdom: Testing waiver (UKAS labs accepted)

PROCESSING TIMELINES

CRS (Scheme-II) with MRA waiver: 8-12 weeks
CRS (Scheme-II) without waiver: 12-16 weeks
FMCS (Scheme-I) Zone Asia: 16-20 weeks
FMCS (Scheme-I) Zone Europe: 20-24 weeks
FMCS (Scheme-I) Zone Americas: 24-28 weeks

ADDITIONAL CHARGES

Sample Testing (if Indian lab required): ₹15,000 - ₹50,000 (lab quote)
Surveillance Testing (post-grant, annual): ₹8,000 per sample
Renewal Processing (every 2 years): 50% of initial marking fee

CURRENCY CONVERSION (Reference Rates, March 2026)
₹1 INR = €0.011 EUR = US$ 0.012 USD
€1 EUR = ₹91.50 INR
US$ 1 USD = ₹83.20 INR

PAYMENT METHODS

- Demand Draft in favor of "Bureau of Indian Standards"
- Online payment via Manak Online portal (NEFT/RTGS)
- International Wire Transfer: SWIFT code provided upon application

For queries: fmcs-fees@bis.gov.in`,

  'fmcs-mra-treaties-2026.pdf': `BUREAU OF INDIAN STANDARDS
MUTUAL RECOGNITION AGREEMENTS (MRA) & TRADE TREATIES
STATUS AS OF 2026

OVERVIEW

India has entered into several Mutual Recognition Agreements (MRAs), Comprehensive Economic 
Partnership Agreements (CEPAs), and Free Trade Agreements (FTAs) that include technical 
standards chapters. These treaties allow:

1. Acceptance of foreign test reports from accredited labs
2. Exemption from Indian lab testing (testing waiver)
3. Exemption from factory audit for certain categories (audit waiver)
4. Reduced processing time (4-8 weeks faster)

ACTIVE TREATIES WITH TESTING WAIVERS

1. GERMANY — Indo-German Technical Cooperation Agreement (2018)

   Agreement Type: MRA
   Sectors Covered: Electronics, Automotive, Electrical Appliances
   IS Standards Covered: IS 16046, IS 15844, IS 13252, IS 2082
   
   Testing Waiver: YES (DAkkS-accredited lab reports accepted)
   Audit Waiver: NO (factory audit still required for Scheme-I)
   
   Effective Date: January 1, 2018
   
   Notes: European lab reports from DAkkS-accredited testing facilities are accepted 
   for the initial FMCS application. This saves 4-6 weeks of Indian lab testing time.
   However, BIS officer audit at the German factory is still mandatory.
   
   Eligible Products: ECUs, LED lamps, IT equipment, geysers

2. EUROPEAN UNION — EU-India FTA Technical Annex (2020)

   Agreement Type: MRA (within broader FTA framework)
   Sectors Covered: Electronics, Automotive, Safety Equipment
   IS Standards Covered: IS 15844, IS 13252, IS 4151
   
   Testing Waiver: YES (CE-marked products with equivalent safety docs)
   Audit Waiver: NO
   
   Effective Date: March 15, 2020
   
   Notes: Products bearing CE mark with conformity declaration and technical file may 
   submit EU test reports in lieu of Indian lab testing. Saves 4 weeks.
   
   Applies to: EU member states (27 countries as of 2026)

3. JAPAN — India-Japan CEPA Technical Standards Annex (2011)

   Agreement Type: CEPA (Comprehensive Economic Partnership Agreement)
   Sectors Covered: Electronics, Automotive
   IS Standards Covered: IS 15844, IS 13252
   
   Testing Waiver: YES (JIS-aligned test reports accepted)
   Audit Waiver: YES (for CRS Scheme-II electronics only)
   
   Effective Date: August 1, 2011
   
   Notes: Japan CEPA includes both testing and audit waivers for electronics under 
   CRS (Scheme-II). JIS certification from accredited Japanese labs fully recognized.
   FMCS Scheme-I products still require audit.
   
   Eligible Products: LED lamps, IT equipment, smartphones

4. SOUTH KOREA — India-Korea CEPA Standards Chapter (2010)

   Agreement Type: CEPA
   Sectors Covered: Electronics, Automotive
   IS Standards Covered: IS 15844, IS 13252
   
   Testing Waiver: YES (KC-marked products accepted)
   Audit Waiver: YES (CRS Scheme-II only)
   
   Effective Date: January 1, 2010
   
   Notes: KC (Korea Certification) marked products with conformity documentation 
   receive full testing waiver. Audit waiver applicable only for CRS electronics.
   
   Eligible Products: LED lamps, IT equipment, mobile handsets

5. UNITED KINGDOM — India-UK FTA Standards Protocol (2023)

   Agreement Type: FTA Technical Chapter
   Sectors Covered: Electrical Appliances, Safety Equipment
   IS Standards Covered: IS 2082, IS 4151
   
   Testing Waiver: YES (UKAS-accredited test reports accepted)
   Audit Waiver: NO
   
   Effective Date: June 1, 2023
   
   Notes: Post-Brexit standalone agreement. UKAS-accredited lab reports accepted 
   for FMCS initial submission. Statutory factory audit still required.
   
   Eligible Products: Electric geysers, helmets

6. UNITED STATES — No Active MRA

   Agreement Type: None
   Status: Negotiations ongoing
   
   Testing Waiver: NO
   Audit Waiver: NO
   
   Notes: No bilateral MRA currently in force between India and USA. Full FMCS 
   process applies including independent Indian lab testing and factory audit.
   US manufacturers must comply with standard FMCS timeline and fees.

HOW TO CLAIM MRA BENEFITS

Step 1: Verify eligibility
- Check if your country has an active treaty
- Confirm your product category is covered
- Verify IS standard is listed in treaty scope

Step 2: Gather supporting documents
- Foreign test report from accredited lab (DAkkS, JIS, KC, UKAS, etc.)
- Lab accreditation certificate (ILAC, ISO 17025)
- Conformity declaration (CE mark, JIS cert, KC cert)
- Treaty certificate (issued by foreign standards body)

Step 3: Mention treaty in FMCS Form-IV
- Section F: Indicate MRA/CEPA/FTA eligibility
- Attach treaty certificate with application
- Submit foreign test report instead of Indian lab report

Step 4: BIS review
- BIS FMCS Cell verifies treaty applicability
- Foreign test report evaluated for equivalence
- Decision communicated within 3 weeks

IMPORTANT NOTES:

1. Testing waiver does NOT automatically grant audit waiver
2. FMCS Scheme-I always requires factory audit (unless explicitly waived by treaty)
3. CRS Scheme-II may receive both testing + audit waiver (Japan, South Korea only)
4. MRA benefits apply only to products explicitly listed in treaty annexes
5. Foreign lab must be accredited by recognized accreditation body

TREATY VERIFICATION:

To verify treaty status or obtain treaty certificate:
- Contact: MRA Cell, Bureau of Indian Standards
- Email: mra@bis.gov.in
- Phone: +91-11-2323-7991

Or contact your country's national standards body:
- Germany: DIN (Deutsches Institut für Normung)
- Japan: JISC (Japanese Industrial Standards Committee)
- South Korea: KATS (Korean Agency for Technology and Standards)
- UK: BSI (British Standards Institution)
- EU: CEN (European Committee for Standardization)

Updated: March 2026`,
};

function createMinimalPdf(text) {
  // Split into lines and wrap long lines
  const rawLines = text.split('\n');
  const lines = [];
  rawLines.forEach(line => {
    if (line.length <= 95) {
      lines.push(line);
    } else {
      // Word wrap
      const words = line.split(' ');
      let current = '';
      words.forEach(word => {
        if ((current + ' ' + word).length <= 95) {
          current = current ? current + ' ' + word : word;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      });
      if (current) lines.push(current);
    }
  });

  // Limit to reasonable page count
  const pageLines = lines.slice(0, 100);
  
  let stream = 'BT\n/F1 9 Tf\n50 750 Td\n12 TL\n';
  pageLines.forEach((line, i) => {
    const safe = line.replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, '');
    if (i === 0) stream += `(${safe}) Tj\n`;
    else stream += `T*\n(${safe}) Tj\n`;
  });
  stream += 'ET';
  
  const streamLen = Buffer.byteLength(stream);
  
  return `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Courier>>endobj
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
0000000343 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
${400 + streamLen}
%%EOF`;
}

// Generate all PDFs
console.log('Generating FMCS PDF documents...\n');

for (const [filename, content] of Object.entries(fmcsDocuments)) {
  const filepath = path.join(pdfDir, filename);
  const pdfContent = createMinimalPdf(content);
  fs.writeFileSync(filepath, pdfContent);
  console.log(`✓ Created ${filename} (${Math.round(pdfContent.length / 1024)}KB)`);
}

console.log(`\n✅ Generated ${Object.keys(fmcsDocuments).length} FMCS PDF documents`);
console.log(`📁 Location: ${pdfDir}`);
console.log('\nNext steps:');
console.log('1. Update knowledge manifest.json');
console.log('2. Update portal_documents table in database');
console.log('3. Restart Clone B API to serve new PDFs');
