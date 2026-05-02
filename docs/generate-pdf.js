const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const targets = [
  { html: 'bonos.html', pdf: 'bonos.pdf' },
  { html: 'plan-completo.html', pdf: 'plan-completo.pdf' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  for (const t of targets) {
    const htmlPath = path.resolve(__dirname, t.html);
    if (!fs.existsSync(htmlPath)) {
      console.log(`Skip ${t.html}: not found`);
      continue;
    }
    const page = await context.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
    await page.pdf({
      path: path.resolve(__dirname, t.pdf),
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });
    await page.close();
    console.log(`PDF generado: docs/${t.pdf}`);
  }
  await browser.close();
})();
