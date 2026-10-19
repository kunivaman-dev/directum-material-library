const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('public/catalog.js','utf8'),context);
const catalog=context.window.ICON_CATALOG;
assert.strictEqual(catalog.length,240,'catalog must contain every Figma owner');
assert.strictEqual(catalog.flatMap(x=>x.variants).length,1185,'variant count must match Figma');
assert.deepStrictEqual([...new Set(catalog.map(x=>x.cat))].sort(),[
  'Без категории','Бизнес-процессы','Документы','Интерфейс','Коммуникации','Отрасли','Пользователи','Системы'
]);
for(const icon of catalog){
  assert(!('description' in icon),'description must be removed from catalog data');
  assert(Array.isArray(icon.keywords),'every icon must expose its Figma keywords field');
  for(const variant of icon.variants){
    assert(['base','outline','small','small-outline','mono','3d'].includes(variant.label));
    const source=fs.readFileSync(path.join('public',variant.file),'utf8').trim();
    assert(source.startsWith('<svg')&&source.includes('</svg>'),variant.file+' must be valid SVG');
  }
}
const nodes=new Map();
const get=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{
    value:'',textContent:'',innerHTML:'',hidden:false,open:false,disabled:false,src:'',alt:'',
    nextElementSibling:{textContent:''},handlers:{},classList:{toggle(){}},
    addEventListener(name,fn){this.handlers[name]=fn},showModal(){this.open=true},close(){this.open=false;this.handlers.close?.()},focus(){}
  });
  return nodes.get(selector);
};
get('#style-filter').options=['','base','outline','small','small-outline','mono','3d'].map(value=>({value}));
get('#palette').options=['directum','esm','hrpro','projects','omni','targets','black','white'].map(value=>({value}));
get('#palette').value='directum';
get('#png-size').value='original';
let clipboard='';
class TestURL extends URL{}
TestURL.createObjectURL=()=> 'blob:test';
TestURL.revokeObjectURL=()=>{};
Object.assign(context,{
  document:{
    querySelector:get,
    addEventListener(){},
    createElement(){return {append(){},click(){},remove(){}}}
  },
  history:{replaceState(){}},location:{search:'',pathname:'/',href:'https://example.test/'},navigator:{platform:'Linux',clipboard:{writeText:async value=>{clipboard=value}}},
  URLSearchParams,URL:TestURL,Blob,
  fetch:async()=>({ok:true,text:async()=>'<svg fill="none"><path fill="white" stroke="black"/></svg>',blob:async()=>new Blob()}),
  setTimeout
});
vm.runInContext(fs.readFileSync('public/app.js','utf8'),context);
assert.strictEqual(get('#visible-count').textContent,240);
assert(get('#grid').innerHTML.includes('class="icon-keywords"'),'icon cards must show keyword chips');
get('#search').value='ежедневник';
get('#search').handlers.input();
assert(Number(get('#visible-count').textContent)>=1,'new Figma keywords must affect search');
assert(get('#active-filter').textContent.includes('Результаты поиска'),'search state must be visible above results');
get('#search').value='круглосуточно';
get('#search').handlers.input();
assert(Number(get('#visible-count').textContent)>=1,'Figma keywords must be searchable');
vm.runInContext("openIcon(icons.find(x=>x.variants.some(v=>v.label==='mono')))",context);
assert(get('#detail').open);
assert(get('#detail-keywords').innerHTML.includes('<span>'),'icon preview must show keyword chips');
assert(get('#palette-swatches').innerHTML.includes('data-tooltip="Directum"'),'palette must render square color swatches with tooltips');
vm.runInContext("setVariant(current.variants.find(v=>v.label==='mono'))",context);
assert.strictEqual(get('#palette').value,'black','mono preview must default to black');
assert(get('#palette-swatches').innerHTML.includes('data-tooltip="Белый"'),'single-color variants must offer black and white swatches');
assert(get('#variants').innerHTML.includes('Монохромный'),'variant choices must use Russian labels');
get('#copy-link').handlers.click();
assert.strictEqual(
  clipboard,
  new URL('/api/icon?file='+vm.runInContext("currentVariant.file.split('/').pop()",context)+'&variant=mono&color=black','https://example.test/').href,
  'selected variant and color must copy a direct absolute SVG URL'
);
const recolored=vm.runInContext("recolorSingleColor('<svg fill=\"none\"><path fill=\"white\" stroke=\"black\"/></svg>','#2195BE')",context);
assert(recolored.includes('fill="white"'),'white knockout must be preserved');
assert(recolored.includes('stroke="#2195BE"'),'ink color must be replaced');
console.log('Catalog integrity, Figma keywords, search, previews, variants and recoloring: passed');
