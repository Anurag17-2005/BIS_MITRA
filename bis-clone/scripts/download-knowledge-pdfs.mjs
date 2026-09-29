#!/usr/bin/env node
/**
 * Download public BIS PDFs into data/knowledge/pdfs/
 * Run: node scripts/download-knowledge-pdfs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, '..', 'data', 'knowledge', 'pdfs');

const DOWNLOADS = [
  // --- Process / certification ---
  { folder: 'process', name: 'grant-of-licence-guidelines-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/02/GrantofLicence-Guidelines-25Feb2026.pdf', topic: 'Scheme-I grant of licence' },
  { folder: 'process', name: 'dealing-with-non-conformity-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/02/Dealing-WithNon-Conformity-Guidelines-25Feb2026.pdf', topic: 'Non-conformity handling' },
  { folder: 'process', name: 'factory-surveillance-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/02/FactorySurveillance-Guidelines-25Feb2026.pdf', topic: 'Factory surveillance' },
  { folder: 'process', name: 'market-surveillance-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/02/MarketSurveillance-Guidelines-25Feb2026.pdf', topic: 'Market surveillance' },
  { folder: 'process', name: 'unsatisfactory-performance-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/02/Dealing-With-Unsatisfactory-Performance-Guidelines-25Feb2026.pdf', topic: 'Unsatisfactory performance' },
  { folder: 'process', name: 'grant-of-licence-guidelines-2023.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/06/3-Guidelines-for-Grant-of-Licence.pdf', topic: 'Grant of licence (2023)' },
  { folder: 'process', name: 'change-in-scope-of-licence.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2021/05/Website-GuidelinesForChangeInScopeOfLicence_may.pdf', topic: 'Change in licence scope' },
  { folder: 'process', name: 'grant-of-coc-guidelines.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2021/03/Grant-of-CoC-Guidelines.pdf', topic: 'Certificate of Conformity' },
  { folder: 'process', name: 'renewal-of-coc-guidelines.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2022/01/Guidelines-RenewalOf-CoC.pdf', topic: 'CoC renewal' },

  // --- Schemes / fees / compulsory ---
  { folder: 'schemes', name: 'guidance-document-on-qcos.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2021/07/Guidance-document-on-QCOs-Revised-1.pdf', topic: 'Quality Control Orders guidance' },
  { folder: 'schemes', name: 'scheme-1-notification-2024.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2024/03/Scheme-1-Notification-07March-2024.pdf', topic: 'Scheme-I notification' },
  { folder: 'schemes', name: 'compulsory-products-list.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2021/07/listofproducts.pdf', topic: 'Products under compulsory certification' },
  { folder: 'schemes', name: 'simplified-procedure-products.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2024/11/List-of-Products-Under-Simplified-Procedure.pdf', topic: 'Simplified certification procedure' },
  { folder: 'schemes', name: 'conformity-assessment-regulations-2019.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2019/03/BIS_CA_12032019.pdf', topic: 'Conformity Assessment Regulations' },
  { folder: 'schemes', name: 'marking-fee-all-products-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/09/Marking-fee-for-all-products-under-certification-scheme-1.pdf', topic: 'Marking fees (all products)' },
  { folder: 'schemes', name: 'marking-fee-gazette-2025.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2025/01/marking-fee-gazette-january-2025.pdf', topic: 'Marking fee gazette notification' },

  // --- Hallmarking ---
  { folder: 'hallmarking', name: 'brief-on-hallmarking.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2020/12/brief-on-Hallmarking.pdf', topic: 'Hallmarking overview' },
  { folder: 'hallmarking', name: 'guide-jeweller-registration.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2020/10/Guide_Jeweller_Registration_v1.1.pdf', topic: 'Jeweller registration' },
  { folder: 'hallmarking', name: 'guide-ahc-recognition-2021.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2021/04/Guide_to_apply_for_recognitio_2021.pdf', topic: 'A&H centre recognition application' },
  { folder: 'hallmarking', name: 'guidelines-for-ahcs-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/07/GuidelinesForAHCs.pdf', topic: 'Guidelines for A&H centres' },
  { folder: 'hallmarking', name: 'guidelines-for-jewellers-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/07/Guidelines-for-Jewellers.pdf', topic: 'Guidelines for jewellers' },
  { folder: 'hallmarking', name: 'offsite-ahc-centres.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2022/03/Guidelines-on-Offsite-centres-of-AHCs.pdf', topic: 'Offsite A&H centres' },
  { folder: 'hallmarking', name: 'consumer-gold-testing-guidelines.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2022/03/Guidelines-on-Testing-of-old-gold-lying-with-the-consumers-from-BIS-recognized-AHC-revised.pdf', topic: 'Consumer gold testing at AHC' },
  { folder: 'hallmarking', name: 'mandatory-hallmarking-order-2020.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2020/01/Mandatory-Hallmarking-Order-15.01.2020.pdf', topic: 'Mandatory hallmarking order' },
  { folder: 'hallmarking', name: 'generic-quality-manual-ahc.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2022/12/Revised-SFM.pdf', topic: 'Generic quality manual (AHC)' },
  { folder: 'hallmarking', name: 'guidelines-ahc-2019.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2019/09/Guidelines_AHC_30092019.pdf', topic: 'A&H centre guidelines (2019)' },
  { folder: 'hallmarking', name: 'phase-wise-mandatory-districts.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/09/Phase-wise-coverage-of-districts-under-gold-mandatory-hallmarking.pdf', topic: 'Mandatory hallmarking district phases' },
  // Bundled locally from repo data/ (no public bis.gov.in URL in download list)
  { folder: 'hallmarking', name: 'gold-jewellery-purity-consumer-compensation-reference.pdf', url: '__local__', topic: 'Gold jewellery purity — consumer compensation reference' },

  // --- Consumer ---
  { folder: 'consumer', name: 'complaint-guidelines-certified-products-2023.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/06/Guidelines.pdf', topic: 'Complaints on certified products' },
  { folder: 'consumer', name: 'complaint-handling-procedure-ompc5.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2020/11/Complaint_Handling_OMPC-5.pdf', topic: 'Complaint handling procedure' },

  // --- Laboratories ---
  { folder: 'labs', name: 'group-1-recognised-labs-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/06/Group_1_24062026.pdf', topic: 'BIS Group-1 recognised labs' },
  { folder: 'labs', name: 'group-2-empanelled-labs-2026.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2026/04/Group-2_23042026.pdf', topic: 'BIS Group-2 empanelled labs' },
  { folder: 'labs', name: 'lab-recognition-scheme-2020.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2020/06/LRS_23062020.pdf', topic: 'Lab Recognition Scheme' },
  { folder: 'labs', name: 'lrs-forms-and-undertakings.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2020/11/LRS-Forms-and-Undertakings.pdf', topic: 'LRS forms' },
  { folder: 'labs', name: 'support-to-other-laboratories-2024.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2024/12/Revised-Guidelines-for-support-to-other-laboratories-dated-2024-12-17.pdf', topic: 'Support to other laboratories' },
  { folder: 'labs', name: 'lrs-fee-annex.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2022/07/LRS-Fee-Annex-A-and-B.pdf', topic: 'LRS fee schedule' },

  // --- Standards meta / training / Hindi ---
  { folder: 'standards-meta', name: 'know-your-standards-portal-writeup.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2022/08/20220524_KYSP_Writeup-2-compressed.pdf', topic: 'Know Your Standards portal' },
  { folder: 'standards-meta', name: 'standards-promotion-bilingual.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/05/SNPbookBilingual.pdf', topic: 'Standards promotion (bilingual)' },
  { folder: 'standards-meta', name: 'training-strategy-2023.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/03/Training-Strategy_14-March-2023.pdf', topic: 'BIS training strategy' },
  { folder: 'standards-meta', name: 'annual-review-statement-hindi-2022.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/12/Review-Statement-2021-2022-Hindi.pdf', topic: 'Hindi document sample' },

  // --- Product manuals (real) ---
  { folder: 'manuals', name: 'PM-IS-4151-helmet-2024.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2024/12/PM_IS_4151_-Dec-24.pdf', topic: 'Product manual IS 4151 helmet' },
  { folder: 'manuals', name: 'PM-IS-623-bicycle-frame-2024.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2024/02/PM-IS-623.pdf', topic: 'Product manual IS 623 bicycle frame' },
  { folder: 'manuals', name: 'PM-IS-3055-clinical-thermometer.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2018/12/Product-Manual-30551-V2.pdf', topic: 'Product manual IS 3055 thermometer' },
  { folder: 'manuals', name: 'PM-IS-10613-bicycle-safety-bilingual.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/02/PM-IS-10613.pdf', topic: 'Product manual IS 10613 bicycle safety (Hindi+EN)' },
  { folder: 'manuals', name: 'PM-IS-269-portland-cement-2023.pdf', url: 'https://www.bis.gov.in/wp-content/uploads/2023/10/PM_IS_269-Oct-2023.pdf', topic: 'Product manual IS 269 cement' },
  // /PDF/cart/ PM_IS_2062 and PM_IS_10748 return HTTP 403 from automation — add manually if needed
];

async function downloadOne(item) {
  const dir = path.join(BASE, item.folder);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, item.name);

  if (item.url === '__local__') {
    if (fs.existsSync(dest)) {
      const st = fs.statSync(dest);
      return { ...item, dest, ok: true, bytes: st.size, skipped: 'local' };
    }
    return { ...item, dest, ok: false, error: 'Local-only PDF missing (copy into knowledge/pdfs/)', bytes: 0 };
  }

  try {
    const res = await fetch(item.url, {
      headers: { 'User-Agent': 'BIS-MITRA-knowledge-fetch/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ...item, dest, ok: false, error: `HTTP ${res.status}`, bytes: 0 };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const isPdf = buf.slice(0, 5).toString() === '%PDF-';
    if (!isPdf && buf.length < 500) {
      return { ...item, dest, ok: false, error: 'Not a PDF (too small or wrong type)', bytes: buf.length };
    }
    fs.writeFileSync(dest, buf);
    return { ...item, dest, ok: true, bytes: buf.length };
  } catch (err) {
    return { ...item, dest, ok: false, error: err.message, bytes: 0 };
  }
}

async function main() {
  console.log(`Downloading ${DOWNLOADS.length} files to ${BASE}\n`);
  const results = [];
  for (const item of DOWNLOADS) {
    const r = await downloadOne(item);
    results.push(r);
    const status = r.ok ? `OK ${(r.bytes / 1024).toFixed(1)} KB` : `FAIL: ${r.error}`;
    console.log(`${r.ok ? '✓' : '✗'} [${item.folder}] ${item.name} — ${status}`);
  }

  const manifest = {
    downloadedAt: new Date().toISOString(),
    source: 'bis.gov.in (public PDFs)',
    total: results.length,
    success: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    files: results.map(r => ({
      folder: r.folder,
      name: r.name,
      topic: r.topic,
      url: r.url,
      path: r.dest ? path.relative(path.join(__dirname, '..'), r.dest) : null,
      ok: r.ok,
      bytes: r.bytes,
      error: r.error || null,
    })),
  };

  const manifestPath = path.join(__dirname, '..', 'data', 'knowledge', 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${manifestPath}`);
  console.log(`Success: ${manifest.success}/${manifest.total}`);
  if (manifest.failed) process.exitCode = 1;
}

main();
