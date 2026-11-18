import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:4321/my/', { waitUntil: 'load' });
await p.evaluate(() => localStorage.setItem('krconcerts:bookmarks', JSON.stringify(['tiffany-day-seoul-2027-02'])));
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => ({ alert: getComputedStyle(document.getElementById('my-alert')).display, empty: getComputedStyle(document.getElementById('my-empty')).display })));
await p.screenshot({ path: process.argv[2] + '/my-one.png' });
await b.close();
