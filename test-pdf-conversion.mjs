import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';

const workerSrc = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const pdfPath = 'uploads/templates/template_9_contract_avl_1761508634203.pdf';

console.log('📄 Analyzing PDF:', pdfPath);

const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
const loadingTask = pdfjsLib.getDocument({
  data: pdfData,
  useWorkerFetch: false,
  isEvalSupported: false,
  useSystemFonts: true,
});

const pdfDocument = await loadingTask.promise;
console.log('📖 PDF loaded with', pdfDocument.numPages, 'page(s)');

const page = await pdfDocument.getPage(1);
const viewport = page.getViewport({ scale: 1 });

console.log('📐 Viewport dimensions:', viewport.width, 'x', viewport.height);

// Get page content
const textContent = await page.getTextContent();
console.log('📝 Text items found:', textContent.items.length);

// Get operator list to see what's being rendered
const opList = await page.getOperatorList();
console.log('🎨 Operators found:', opList.fnArray.length);
console.log('🖼️ Operator types:', [...new Set(opList.fnArray)].join(', '));

await pdfDocument.destroy();
