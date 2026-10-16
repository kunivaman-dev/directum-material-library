const icons=window.ICON_CATALOG||[];
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>String(s||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[–—/_-]+/g,' ').replace(/\s+/g,' ').trim();
const grid=document.querySelector('#grid');
const search=document.querySelector('#search');
const styleFilter=document.querySelector('#style-filter');
const paletteSelect=document.querySelector('#palette');
const extendedColorOptions=[document.querySelector('#black-color-option'),document.querySelector('#white-color-option')];
const dialogPreview=document.querySelector('.dialog-preview');
const nav=document.querySelector('#categories');
const count=document.querySelector('#visible-count');
const filterLabel=document.querySelector('#active-filter');
const empty=document.querySelector('#empty');
const dialog=document.querySelector('#detail');
const status=document.querySelector('#download-status');
let category='Все';
let current=null;
let currentVariant=null;
const palettes={
  directum:{name:'Directum',brand:'#FF8000',fade:'#FFD299'},
  esm:{name:'ESM',brand:'#2195BE',fade:'#74EAFC'},
  hrpro:{name:'HR Pro',brand:'#A4305A',fade:'#D77598'},
  projects:{name:'Projects',brand:'#70AC30',fade:'#96D447'},
  omni:{name:'Omni',brand:'#9541C0',fade:'#C99FDF'},
  targets:{name:'Targets',brand:'#0043A4',fade:'#79AEF9'}
};
const lineColors={
  directum:{name:'Directum',value:'#FF8000'},esm:{name:'ESM',value:'#2195BE'},
  hrpro:{name:'HR Pro',value:'#A4305A'},projects:{name:'Projects',value:'#70AC30'},
  omni:{name:'Omni',value:'#9541C0'},targets:{name:'Targets',value:'#0043A4'},
  black:{name:'Чёрный',value:'#000000'},white:{name:'Белый',value:'#FFFFFF'}
};
const singleColorVariants=new Set(['outline','small-outline','mono']);
const variantLabels={base:'Основной',outline:'Контурный',small:'Малый','small-outline':'Малый контурный',mono:'Монохромный','3d':'Объёмный'};
const recoloredUrls=new Map();
let previewRequest=0;
const preferredCategories=['Все','Системы','Интерфейс','Пользователи','Бизнес-процессы','Коммуникации','Отрасли','Документы','Без категории'];
const availableCategories=new Set(icons.map(x=>x.cat));
const categories=preferredCategories.filter(x=>x==='Все'||availableCategories.has(x))
  .concat([...availableCategories].filter(x=>!preferredCategories.includes(x)).sort((a,b)=>a.localeCompare(b,'ru')));
const plural=n=>n%10===1&&n%100!==11?'иконка':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'иконки':'иконок';

function syncUrl(includeIcon=Boolean(current&&dialog.open)){
  const params=new URLSearchParams();
  if(search.value.trim())params.set('q',search.value.trim());
  if(category!=='Все')params.set('category',category);
  if(styleFilter.value)params.set('style',styleFilter.value);
  if(includeIcon&&current){
    params.set('icon',current.id);
    if(currentVariant)params.set('variant',currentVariant.label);
    if(paletteSelect.value!=='directum')params.set('color',paletteSelect.value);
  }
  history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));
}
function renderNav(){
  nav.innerHTML=categories.map(cat=>{
    const n=cat==='Все'?icons.length:icons.filter(x=>x.cat===cat).length;
    return '<button class="category '+(cat===category?'active':'')+'" data-cat="'+escapeHtml(cat)+'" aria-pressed="'+(cat===category)+'"><span>'+escapeHtml(cat)+'</span><span>'+n+'</span></button>';
  }).join('');
}
function visible(){
  const words=normalize(search.value).split(' ').filter(Boolean);
  return icons.filter(x=>{
    if(category!=='Все'&&x.cat!==category)return false;
    if(styleFilter.value&&!x.variants.some(v=>v.label===styleFilter.value))return false;
    const haystack=normalize([x.title,x.name,x.cat,...(x.keywords||[])].join(' '));
    return words.every(word=>haystack.includes(word));
  });
}
function render(){
  const list=visible();
  count.textContent=list.length;
  count.nextElementSibling.textContent=plural(list.length);
  const query=search.value.trim();
  const context=[];
  if(category!=='Все')context.push(category);
  if(styleFilter.value)context.push(variantLabels[styleFilter.value]||styleFilter.value);
  const filterName=query
    ?'Результаты поиска «'+query+'»'+(context.length?' · '+context.join(' · '):'')
    :(context.length?context.join(' · '):'Все иконки');
  filterLabel.textContent=filterName+' · '+list.length+' '+plural(list.length);
  grid.innerHTML=list.map(x=>{
    const variant=x.variants.find(v=>v.label===styleFilter.value)||x.variants[0];
    const keywords=(x.keywords||[]).map(keyword=>'<span>'+escapeHtml(keyword)+'</span>').join('');
    return '<button class="icon-card" data-id="'+escapeHtml(x.id)+'"><span class="quick">SVG / PNG</span><span class="icon-visual"><img src="'+escapeHtml(variant.file)+'" alt="" loading="lazy"></span><span class="icon-name">'+escapeHtml(x.title)+'</span><span class="icon-keywords" aria-label="Ключевые слова: '+escapeHtml((x.keywords||[]).join(', '))+'">'+keywords+'</span><span class="icon-meta">'+escapeHtml(x.cat)+' · '+x.variants.length+' '+(x.variants.length===1?'вариант':'вариантов')+'</span></button>';
  }).join('');
  empty.hidden=list.length!==0;
  grid.hidden=list.length===0;
}
function openIcon(icon,requestedVariant){
  if(!icon)return;
  current=icon;
  const selected=icon.variants.find(v=>v.label===requestedVariant)
    ||icon.variants.find(v=>v.label===styleFilter.value)||icon.variants[0];
  document.querySelector('#variants').innerHTML=icon.variants.map((v,i)=>'<label class="variant-choice"><input type="radio" name="variant" value="'+i+'" '+(v===selected?'checked':'')+'>'+escapeHtml(variantLabels[v.label]||v.label)+'</label>').join('');
  document.querySelector('#detail-name').textContent=icon.title;
  document.querySelector('#detail-cat').textContent=icon.cat;
  document.querySelector('#detail-keywords').innerHTML=(icon.keywords||[]).map(keyword=>'<span>'+escapeHtml(keyword)+'</span>').join('');
  status.textContent='';
  setVariant(selected,false);
  if(!dialog.open)dialog.showModal();
  syncUrl(true);
}
function setVariant(variant,updateUrl=true){
  currentVariant=variant;
  const singleColor=singleColorVariants.has(variant.label);
  extendedColorOptions.forEach(option=>{option.hidden=!singleColor;option.disabled=!singleColor});
  if(variant.label==='mono'&&paletteSelect.value!=='black'&&paletteSelect.value!=='white')paletteSelect.value='black';
  if(!singleColor&&(paletteSelect.value==='black'||paletteSelect.value==='white'))paletteSelect.value='directum';
  dialogPreview.classList.toggle('white-icon',singleColor&&paletteSelect.value==='white');
  const img=document.querySelector('#detail-img');
  img.src=variant.file;
  img.alt=current.title+' — '+variant.label;
  document.querySelector('#variant-size').textContent='Исходный размер: '+variant.width+' × '+variant.height+' px';
  status.textContent='';
  updatePreview();
  if(updateUrl)syncUrl(true);
}
function paintValue(value){
  const v=value.trim().toLocaleLowerCase();
  return v&&v!=='none'&&v!=='transparent'&&!v.startsWith('url(');
}
function isWhite(value){
  return ['white','#fff','#ffffff','rgb(255,255,255)','rgb(255, 255, 255)'].includes(value.trim().toLocaleLowerCase());
}
function recolorSingleColor(svg,color){
  const values=[];
  svg.replace(/\b(?:stroke|fill)="([^"]+)"/gi,(_,v)=>{values.push(v);return _});
  svg.replace(/\b(?:stroke|fill):\s*([^;"']+)/gi,(_,v)=>{values.push(v);return _});
  const hasNonWhite=values.some(v=>paintValue(v)&&!isWhite(v));
  const replacement=value=>!paintValue(value)||(hasNonWhite&&isWhite(value))?value:color;
  return svg
    .replace(/\b(stroke|fill)="([^"]+)"/gi,(match,attribute,value)=>attribute+'="'+replacement(value)+'"')
    .replace(/\b(stroke|fill):\s*([^;"']+)/gi,(match,attribute,value)=>attribute+':'+replacement(value));
}
async function paletteSource(variant){
  if(singleColorVariants.has(variant.label)){
    const color=lineColors[paletteSelect.value]||lineColors.directum;
    const key=variant.file+'|single|'+paletteSelect.value;
    if(recoloredUrls.has(key))return recoloredUrls.get(key);
    const response=await fetch(variant.file);
    if(!response.ok)throw new Error('Asset unavailable');
    const svg=recolorSingleColor(await response.text(),color.value);
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    recoloredUrls.set(key,url);
    return url;
  }
  const palette=palettes[paletteSelect.value]||palettes.directum;
  if(palette===palettes.directum)return variant.file;
  const key=variant.file+'|'+paletteSelect.value;
  if(recoloredUrls.has(key))return recoloredUrls.get(key);
  const response=await fetch(variant.file);
  if(!response.ok)throw new Error('Asset unavailable');
  const svg=(await response.text()).replace(/#(?:FF8000|FF7A00)/gi,palette.brand).replace(/#FFD299/gi,palette.fade);
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  recoloredUrls.set(key,url);
  return url;
}
async function updatePreview(){
  const request=++previewRequest;
  const img=document.querySelector('#detail-img');
  try{
    dialogPreview.classList.toggle('white-icon',singleColorVariants.has(currentVariant.label)&&paletteSelect.value==='white');
    const source=await paletteSource(currentVariant);
    if(request===previewRequest)img.src=source;
  }catch{
    if(request===previewRequest)img.src=currentVariant.file;
  }
}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove()}
async function copyText(value,success){
  try{await navigator.clipboard.writeText(value);status.textContent=success}
  catch{status.textContent='Не удалось скопировать. Проверьте доступ браузера к буферу обмена.'}
}
async function copySvg(){
  status.textContent='Подготавливаем SVG…';
  try{
    const source=await paletteSource(currentVariant);
    const response=await fetch(source);
    if(!response.ok)throw new Error('Asset unavailable');
    await copyText(await response.text(),'SVG скопирован — можно вставить его в редактор или код.');
  }catch{status.textContent='Не удалось скопировать SVG. Попробуйте скачать файл.'}
}
async function copyLink(){
  const variantUrl=new URL('/api/icon',location.href);
  variantUrl.searchParams.set('file',currentVariant.file.split('/').pop());
  variantUrl.searchParams.set('variant',currentVariant.label);
  variantUrl.searchParams.set('color',paletteSelect.value);
  await copyText(variantUrl.href,'Прямая ссылка на вариант и цвет скопирована.');
}
async function downloadSvg(icon){
  status.textContent='Подготавливаем SVG…';
  try{
    const palette=palettes[paletteSelect.value]||palettes.directum;
    const source=await paletteSource(currentVariant);
    const colorName=singleColorVariants.has(currentVariant.label)?(lineColors[paletteSelect.value]||lineColors.directum).name:palette.name;
    download(source,icon.name+'-'+currentVariant.label+'-'+colorName.toLocaleLowerCase('ru')+'.svg');
    status.textContent='SVG скачан.';
  }catch{status.textContent='Не удалось скачать SVG. Попробуйте ещё раз.'}
}
async function downloadPng(icon){
  const variant=currentVariant;
  const choice=document.querySelector('#png-size').value;
  const button=document.querySelector('#download-png');
  button.disabled=true;status.textContent='Подготавливаем PNG…';
  let url;
  try{
    const source=await paletteSource(variant);
    const response=await fetch(source);
    if(!response.ok)throw new Error('Asset unavailable');
    url=URL.createObjectURL(await response.blob());
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});
    const w=variant.width||image.naturalWidth,h=variant.height||image.naturalHeight;
    const scale=choice==='original'?1:Number(choice)/Math.max(w,h);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('PNG export failed');
    const png=URL.createObjectURL(blob);
    download(png,icon.name+'-'+variant.label+'-'+canvas.width+'x'+canvas.height+'.png');
    setTimeout(()=>URL.revokeObjectURL(png),1000);
    status.textContent='PNG скачан.';
  }catch{status.textContent='Не удалось скачать PNG. Попробуйте ещё раз или скачайте SVG.'}
  finally{if(url)URL.revokeObjectURL(url);button.disabled=false}
}
document.querySelector('#variants').addEventListener('change',e=>{const variant=current?.variants[Number(e.target.value)];if(variant)setVariant(variant)});
nav.addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;category=b.dataset.cat;renderNav();render();syncUrl(false)});
grid.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)openIcon(icons.find(x=>x.id===b.dataset.id))});
search.addEventListener('input',()=>{render();syncUrl(false)});
styleFilter.addEventListener('change',()=>{render();syncUrl(false)});
paletteSelect.addEventListener('change',()=>{status.textContent='';updatePreview();syncUrl(true)});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}if(e.key==='Escape'&&dialog.open)dialog.close()});
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
dialog.addEventListener('close',()=>{current=null;currentVariant=null;syncUrl(false)});
document.querySelector('#download-svg').addEventListener('click',()=>current&&downloadSvg(current));
document.querySelector('#download-png').addEventListener('click',()=>current&&downloadPng(current));
document.querySelector('#copy-svg').addEventListener('click',()=>current&&copySvg());
document.querySelector('#copy-link').addEventListener('click',()=>current&&copyLink());
document.querySelector('#reset').addEventListener('click',()=>{category='Все';search.value='';styleFilter.value='';renderNav();render();syncUrl(false);search.focus()});

const params=new URLSearchParams(location.search);
search.value=params.get('q')||'';
category=categories.includes(params.get('category'))?params.get('category'):'Все';
if([...styleFilter.options].some(x=>x.value===params.get('style')))styleFilter.value=params.get('style');
if([...paletteSelect.options].some(x=>x.value===params.get('color')))paletteSelect.value=params.get('color');
document.querySelector('.search kbd').textContent=(/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl')+' K';
renderNav();render();
const initialIcon=icons.find(x=>x.id===params.get('icon'));
if(initialIcon)openIcon(initialIcon,params.get('variant'));
