const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=__dirname;
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'public/logos-catalog.js'),'utf8'),sandbox);
const logos=sandbox.window.LOGO_CATALOG;
const expectedBrands=['Directum','Directum RX','Targets','ESM','Omni','HR Pro','Projects','Lite','СЭД+','Development Studio'];
if(!Array.isArray(logos)||logos.length!==58)throw new Error(`Expected 58 logo variants, got ${logos?.length}`);
if(new Set(logos.map(item=>item.id)).size!==logos.length)throw new Error('Logo IDs must be unique');
if(JSON.stringify([...new Set(logos.map(item=>item.brand))])!==JSON.stringify(expectedBrands))throw new Error('Logo brands are missing or out of order');
for(const item of logos){
  if(!['horizontal','vertical','icon'].includes(item.layout))throw new Error(`Unknown layout: ${item.id}`);
  if(!['color','mono','black','white','base','gray'].includes(item.tone))throw new Error(`Unknown tone: ${item.id}`);
  if(!/^\d+:\d+$/.test(item.node))throw new Error(`Invalid Figma node: ${item.id}`);
  const file=path.join(root,'public',item.file);
  if(!fs.existsSync(file))throw new Error(`Missing asset: ${item.file}`);
  const svg=fs.readFileSync(file,'utf8');
  if(!/<svg\b/i.test(svg)||!/<\/svg>/i.test(svg))throw new Error(`Invalid SVG: ${item.file}`);
}
for(const page of ['icons.html','logos.html','logobook.html']){
  const html=fs.readFileSync(path.join(root,'public',page),'utf8');
  for(const href of ['icons.html','logos.html','logobook.html'])if(!html.includes(`href="${href}"`))throw new Error(`${page} misses ${href} navigation`);
  if(!html.includes('assets/directum-site-mark.svg'))throw new Error(`${page} misses the Directum site mark`);
}
if(!fs.existsSync(path.join(root,'public/assets/directum-site-mark.svg')))throw new Error('Missing Directum site mark asset');
const logosHtml=fs.readFileSync(path.join(root,'public/logos.html'),'utf8');
if(!logosHtml.includes('id="product-directory"')||!logosHtml.includes('id="product-detail"'))throw new Error('Logos page must contain directory and product views');
if(logosHtml.includes('logo-sidebar')||logosHtml.includes('id="logo-brands"'))throw new Error('Logos page must not contain the legacy sidebar');
if(logosHtml.includes('id="logo-search"')||logosHtml.includes('id="layout-filter"')||logosHtml.includes('id="tone-filter"'))throw new Error('Logos page must show all variants without search or filters');
const logosJs=fs.readFileSync(path.join(root,'public/logos.js'),'utf8');
if(!logosJs.includes("window.addEventListener('popstate'")||!logosJs.includes('history.pushState'))throw new Error('Logos page must preserve two-level browser navigation');
const developmentStudio=logos.filter(item=>item.brand==='Development Studio');
if(JSON.stringify(developmentStudio.map(item=>item.id))!==JSON.stringify(['development-studio-horizontal-base','development-studio-horizontal-gray','development-studio-icon-base-64']))throw new Error('Development Studio must contain only Base, Gray, and Logo 64');
console.log(`Logo catalog integrity passed: ${logos.length} variants across ${expectedBrands.length} brands`);
