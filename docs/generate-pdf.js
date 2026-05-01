const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const htmlPath = path.resolve(__dirname, 'bonos.html');
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.pdf({
    path: path.resolve(__dirname, 'bonos.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log('PDF generado: docs/bonos.pdf');
})();
