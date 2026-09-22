const icons=window.ICON_DATA||[];
const families=window.ICON_FAMILIES||[];
function canonicalizeVariants(list){
  let hasSmall=false,hasBase=false,hasOutline=false;
  const seen=new Set();
  return list.map(v=>{
    const raw=String(v.label).toLocaleLowerCase('ru').trim();
    let label;
    if(raw.includes('3d'))label='3d';
    else if(raw==='mono'||raw.includes('mono'))label='mono';
    else if(raw.includes('small-outline'))label='small-outline';
    else if(raw.includes('small'))label=raw.includes('outline')?'small-outline':'small';
    else if(raw.includes('outline'))label='outline';
    else if(raw==='base'||raw==='default')label='base';
    else if(Number(v.width)<=32)label=hasSmall?'small-outline':'small';
    else if(!hasBase)label='base';
    else if(!hasOutline)label='outline';
    else label=v.label;
    if(label==='small')hasSmall=true;
    if(label==='base')hasBase=true;
    if(label==='outline')hasOutline=true;
    return {...v,label};
  }).filter(v=>{
    const key=String(v.label).toLocaleLowerCase('ru').trim();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
for(const family of families){
  family.variants=canonicalizeVariants(family.variants);
  const existing=icons.find(x=>x.name.toLocaleLowerCase('ru')===family.name.toLocaleLowerCase('ru'));
  if(existing&&!existing.variants){existing.variants=family.variants;existing.file=family.variants[0].file;}
  else icons.push({...family,file:family.variants[0].file});
}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grid=document.querySelector('#grid');
const search=document.querySelector('#search');
const styleFilter=document.querySelector('#style-filter');
const paletteSelect=document.querySelector('#palette');
const nav=document.querySelector('#categories');
const count=document.querySelector('#visible-count');
const filterLabel=document.querySelector('#active-filter');
const empty=document.querySelector('#empty');
const dialog=document.querySelector('#detail');
let category='Все';
let current=null;
let currentVariant=null;
const palettes={
  orange:{name:'Directum',brand:'#FF8000',fade:'#FFD299'},
  esm:{name:'ESM',brand:'#2195BE',fade:'#74EAFC'},
  hrpro:{name:'HR Pro',brand:'#A4305A',fade:'#D77598'},
  projects:{name:'Projects',brand:'#70AC30',fade:'#96D447'},
  omni:{name:'Omni',brand:'#9541C0',fade:'#C99FDF'},
  targets:{name:'Targets',brand:'#0043A4',fade:'#79AEF9'}
};
const recoloredUrls=new Map();
let previewRequest=0;

const categories=['Все',...new Set(icons.map(x=>x.cat))];
const plural=n=>n%10===1&&n%100!==11?'иконка':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'иконки':'иконок';

function renderNav(){
  nav.innerHTML=categories.map(cat=>{
    const n=cat==='Все'?icons.length:icons.filter(x=>x.cat===cat).length;
    return '<button class="category '+(cat===category?'active':'')+'" data-cat="'+cat+'"><span>'+cat+'</span><span>'+n+'</span></button>';
  }).join('');
}
function visible(){
  const q=search.value.trim().toLocaleLowerCase('ru');
  return icons.filter(x=>(category==='Все'||x.cat===category)&&(!styleFilter.value||x.variants?.some(v=>v.label===styleFilter.value))&&(!q||x.name.toLocaleLowerCase('ru').includes(q)||x.cat.toLocaleLowerCase('ru').includes(q)));
}
function render(){
  const list=visible();
  count.textContent=list.length;
  count.nextElementSibling.textContent=plural(list.length);
  filterLabel.textContent=category==='Все'?'Все иконки':category;
  grid.innerHTML=list.map(x=>'<button class="icon-card" data-id="'+escapeHtml(x.id)+'"><span class="quick">SVG / PNG</span><span class="icon-visual"><img src="'+escapeHtml(x.variants?.find(v=>v.label===styleFilter.value)?.file||x.file)+'" alt="" loading="lazy"></span><span class="icon-name">'+escapeHtml(x.name)+'</span><span class="icon-meta">'+escapeHtml(x.cat)+(x.variants?' · '+x.variants.length+' вариантов':'')+'</span></button>').join('');
  empty.hidden=list.length!==0;
  grid.hidden=list.length===0;
}
function openIcon(icon){
  current=icon;
  const variants=icon.variants||[{label:'Исходный',file:icon.file}];
  const selected=variants.find(v=>v.label===styleFilter.value)||variants[0];
  document.querySelector('#variants').innerHTML=variants.map((v,i)=>'<label class="variant-choice"><input type="radio" name="variant" value="'+i+'" '+(v===selected?'checked':'')+'>'+escapeHtml(v.label)+'</label>').join('');
  setVariant(selected);
  document.querySelector('#detail-name').textContent=icon.name;
  document.querySelector('#detail-cat').textContent=icon.cat;
  dialog.showModal();
}
function setVariant(variant){
  currentVariant=variant;
  const img=document.querySelector('#detail-img');
  img.src=variant.file;
  img.alt=current.name+' — '+variant.label;
  document.querySelector('#variant-size').textContent=variant.width?'Исходный размер: '+variant.width+' × '+variant.height+' px':'Исходный вариант из Figma';
  updatePreview();
}
async function paletteSource(variant){
  const palette=palettes[paletteSelect.value]||palettes.orange;
  if(palette===palettes.orange)return variant.file;
  const key=variant.file+'|'+paletteSelect.value;
  if(recoloredUrls.has(key))return recoloredUrls.get(key);
  const response=await fetch(variant.file);
  if(!response.ok)throw new Error('Asset unavailable');
  const svg=(await response.text())
    .replace(/#(?:FF8000|FF7A00)/gi,palette.brand)
    .replace(/#FFD299/gi,palette.fade);
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  recoloredUrls.set(key,url);
  return url;
}
async function updatePreview(){
  const request=++previewRequest;
  const img=document.querySelector('#detail-img');
  try{
    const source=await paletteSource(currentVariant);
    if(request===previewRequest)img.src=source;
  }catch(error){
    if(request===previewRequest)img.src=currentVariant.file;
  }
}
document.querySelector('#variants').addEventListener('change',e=>{
  const variant=current.variants?.[Number(e.target.value)];
  if(variant)setVariant(variant);
});
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove()}
async function downloadSvg(icon){
  const palette=palettes[paletteSelect.value]||palettes.orange;
  const source=await paletteSource(currentVariant);
  download(source,icon.name+'-'+currentVariant.label+'-'+palette.name.toLocaleLowerCase('ru')+'.svg');
}
async function downloadPng(icon){
  const variant=currentVariant;
  const choice=document.querySelector('#png-size').value;
  const button=document.querySelector('#download-png');
  button.disabled=true;
  let url;
  try{
    const source=await paletteSource(variant);
    const response=await fetch(source);
    if(!response.ok)throw new Error('Asset unavailable');
    url=URL.createObjectURL(await response.blob());
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
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
  }catch(error){alert('Не удалось скачать PNG. Попробуйте ещё раз или скачайте SVG.');}
  finally{if(url)URL.revokeObjectURL(url);button.disabled=false;}
}
nav.addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;category=b.dataset.cat;renderNav();render()});
grid.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)openIcon(icons.find(x=>x.id===b.dataset.id))});
search.addEventListener('input',render);
styleFilter.addEventListener('change',render);
paletteSelect.addEventListener('change',updatePreview);
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}if(e.key==='Escape'&&dialog.open)dialog.close()});
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
document.querySelector('#download-svg').addEventListener('click',()=>current&&downloadSvg(current));
document.querySelector('#download-png').addEventListener('click',()=>current&&downloadPng(current));
document.querySelector('#reset').addEventListener('click',()=>{category='Все';search.value='';styleFilter.value='';renderNav();render();search.focus()});
renderNav();render();
