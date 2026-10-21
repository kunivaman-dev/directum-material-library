const logos=window.LOGO_CATALOG||[];
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize=value=>String(value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[–—/_-]+/g,' ').replace(/\s+/g,' ').trim();
const brandOrder=['Directum','Directum RX','Targets','ESM','Omni','HR Pro','Projects','Lite','СЭД+','Development Studio'];
const representatives={
  'Directum':'directum-horizontal-color','Directum RX':'directum-rx-horizontal-color','Targets':'targets-horizontal-full-color',
  'ESM':'esm-horizontal-full-color','Omni':'omni-horizontal-full-color','HR Pro':'hr-pro-horizontal-full-color',
  'Projects':'projects-horizontal-full-color','Lite':'lite-horizontal-color','СЭД+':'sedplus-horizontal-full-color',
  'Development Studio':'development-studio-horizontal-base'
};
const layoutLabels={horizontal:'Горизонтальный',vertical:'Вертикальный',icon:'Знак'};
const toneLabels={color:'Цветной',mono:'Моно',black:'Чёрный',white:'Белый',base:'Base',gray:'Gray'};
const directory=document.querySelector('#product-directory');
const productDetail=document.querySelector('#product-detail');
const productGrid=document.querySelector('#product-grid');
const grid=document.querySelector('#logo-grid');
const count=document.querySelector('#logo-count');
const dialog=document.querySelector('#logo-detail');
let brand=null;
let current=null;
let routing=false;
let directoryScroll=0;

function plural(number){return number%10===1&&number%100!==11?'вариант':number%10>=2&&number%10<=4&&(number%100<10||number%100>=20)?'варианта':'вариантов'}
function renderDirectory(){
  productGrid.innerHTML=brandOrder.map(name=>{
    const items=logos.filter(item=>item.brand===name);
    const representative=logos.find(item=>item.id===representatives[name])||items[0];
    const layouts=[...new Set(items.map(item=>layoutLabels[item.layout]))].join(' · ');
    return '<button class="product-card" data-product="'+escapeHtml(name)+'"><span class="product-logo '+(name==='Directum'?'dark':'')+'"><img src="'+escapeHtml(representative.file)+'?v=1" alt="" loading="lazy"></span><span class="product-card-copy"><strong>'+escapeHtml(name)+'</strong><span>'+items.length+' '+plural(items.length)+'</span><small>'+escapeHtml(layouts)+'</small></span><span class="product-card-action" aria-hidden="true">Открыть</span></button>';
  }).join('');
}
function renderProduct(){
  const list=logos.filter(item=>item.brand===brand);
  document.querySelector('#product-title').textContent=brand;
  count.textContent=list.length;
  grid.innerHTML=list.map(item=>'<button class="logo-card" data-logo="'+escapeHtml(item.id)+'"><span class="logo-preview '+(item.tone==='white'?'dark':'')+'"><img src="'+escapeHtml(item.file)+'?v=1" data-layout="'+item.layout+'" alt="" loading="lazy"></span><span class="logo-card-head"><strong>'+escapeHtml(item.title)+'</strong><span>'+escapeHtml(toneLabels[item.tone])+'</span></span><span class="logo-card-title">'+escapeHtml(layoutLabels[item.layout])+'</span></button>').join('');
}
function showDirectory(){
  brand=null;
  current=null;
  directory.hidden=false;
  productDetail.hidden=true;
  document.title='Логотипы Directum';
}
function showProduct(name){
  brand=name;
  directory.hidden=true;
  productDetail.hidden=false;
  document.title=name+' — логотипы Directum';
  renderProduct();
}
function buildUrl(includeLogo=Boolean(current&&dialog.open)){
  const params=new URLSearchParams();
  if(brand)params.set('brand',brand);
  if(includeLogo&&current)params.set('logo',current.id);
  return location.pathname+(params.size?'?'+params:'');
}
function replaceUrl(includeLogo){if(!routing)history.replaceState(null,'',buildUrl(includeLogo))}
function openProduct(name,push=true){
  directoryScroll=window.scrollY;
  showProduct(name);
  if(push)history.pushState(null,'',buildUrl(false));
  requestAnimationFrame(()=>window.scrollTo(0,0));
}
function openLogo(item,sync=true){
  current=item;
  const preview=document.querySelector('#logo-detail-preview');
  preview.classList.toggle('dark',item.tone==='white');
  const image=document.querySelector('#logo-detail-img');
  image.src=item.file+'?v=1';
  image.alt=item.brand+' — '+item.title;
  document.querySelector('#logo-detail-brand').textContent=item.brand;
  document.querySelector('#logo-detail-name').textContent=item.title;
  document.querySelector('#logo-detail-tags').innerHTML='<span>'+escapeHtml(layoutLabels[item.layout])+'</span><span>'+escapeHtml(toneLabels[item.tone])+'</span>';
  document.querySelector('#logo-detail-size').textContent='SVG · масштабируется без потери качества';
  const download=document.querySelector('#logo-download');
  download.href=item.file;
  download.download=item.id+'.svg';
  document.querySelector('#logo-figma').href='https://www.figma.com/design/FvX1U25kcxavZk0G2nq5HlPd/?node-id='+item.node.replace(':','-');
  if(!dialog.open)dialog.showModal();
  if(sync)replaceUrl(true);
}
function routeFromUrl(){
  routing=true;
  current=null;
  if(dialog.open)dialog.close();
  const params=new URLSearchParams(location.search);
  const initialLogo=logos.find(item=>item.id===params.get('logo'));
  const requestedBrand=brandOrder.includes(params.get('brand'))?params.get('brand'):initialLogo?.brand;
  if(!requestedBrand){showDirectory();routing=false;return}
  showProduct(requestedBrand);
  if(initialLogo)openLogo(initialLogo,false);
  routing=false;
}

productGrid.addEventListener('click',event=>{const card=event.target.closest('[data-product]');if(card)openProduct(card.dataset.product)});
document.querySelector('#back-products').addEventListener('click',()=>{showDirectory();history.pushState(null,'',location.pathname);requestAnimationFrame(()=>window.scrollTo(0,directoryScroll));document.querySelector('.product-card')?.focus({preventScroll:true})});
grid.addEventListener('click',event=>{const card=event.target.closest('[data-logo]');if(card)openLogo(logos.find(item=>item.id===card.dataset.logo))});
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
dialog.addEventListener('close',()=>{current=null;replaceUrl(false)});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open)dialog.close()});
window.addEventListener('popstate',routeFromUrl);

renderDirectory();
routeFromUrl();
