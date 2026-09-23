const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/catalog.js','utf8'),context);
const catalog=context.window.ICON_CATALOG;
assert.strictEqual(catalog.length,238,'catalog must contain every Figma owner');
assert.strictEqual(catalog.flatMap(x=>x.variants).length,1183,'variant count must match Figma');
assert.deepStrictEqual([...new Set(catalog.map(x=>x.cat))].sort(),[
  'Без категории','Бизнес-процессы','Документы','Интерфейс','Коммуникации','Отрасли','Пользователи','Системы'
]);
for(const icon of catalog){
  assert(icon.description);
  assert(icon.keywords.includes(icon.name));
  assert(!icon.keywords.join(' ').toLocaleLowerCase('ru').includes('ежедневник'),'legacy tags must not leak into search metadata');
  for(const variant of icon.variants){
    assert(['base','outline','small','small-outline','mono','3d'].includes(variant.label));
    const source=fs.readFileSync(path.join('dist',variant.file),'utf8').trim();
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
Object.assign(context,{
  document:{
    querySelector:get,
    addEventListener(){},
    createElement(){return {append(){},click(){},remove(){}}}
  },
  history:{replaceState(){}},location:{search:'',pathname:'/'},navigator:{platform:'Linux'},
  URLSearchParams,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,
  fetch:async()=>({ok:true,text:async()=>'<svg fill="none"><path fill="white" stroke="black"/></svg>',blob:async()=>new Blob()}),
  setTimeout
});
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
assert.strictEqual(get('#visible-count').textContent,238);
get('#search').value='ежедневник';
get('#search').handlers.input();
assert.strictEqual(get('#visible-count').textContent,0,'stale legacy tags must not affect search');
get('#search').value='загрузка материалов';
get('#search').handlers.input();
assert(Number(get('#visible-count').textContent)>=1,'descriptions must be searchable');
vm.runInContext("openIcon(icons.find(x=>x.variants.some(v=>v.label==='mono')))",context);
assert(get('#detail').open);
assert(get('#detail-description').textContent);
const recolored=vm.runInContext("recolorSingleColor('<svg fill=\"none\"><path fill=\"white\" stroke=\"black\"/></svg>','#2195BE')",context);
assert(recolored.includes('fill="white"'),'white knockout must be preserved');
assert(recolored.includes('stroke="#2195BE"'),'ink color must be replaced');
console.log('Catalog integrity, clean search metadata, descriptions, variants and recoloring: passed');
