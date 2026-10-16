(()=>{
  const endpoint='/api/events';
  const path=location.pathname;
  const section=path.includes('logos')?'logos':path.includes('logobook')?'logobook':'icons';
  let searchTimer=0,lastSearch='';
  function params(){return new URLSearchParams(location.search)}
  function send(event,data={}){
    const body=JSON.stringify({event,section,...data});
    fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  function searchCount(){
    const node=document.querySelector(section==='logos'?'#logo-count':'#visible-count');
    const value=Number(node?.textContent);
    return Number.isFinite(value)?value:0;
  }
  function scheduleSearch(input){
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{
      const query=input.value.trim().replace(/\s+/g,' ');
      if(query.length<2||query===lastSearch)return;
      lastSearch=query;
      const resultCount=searchCount();
      send(resultCount===0?'zero_result':'search',resultCount===0?{query,resultCount}:{resultCount});
    },900);
  }
  document.addEventListener('input',event=>{
    if(event.target.matches('#search,#logo-search'))scheduleSearch(event.target);
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('a,button');
    if(!target)return;
    const query=params();
    const assetId=query.get('icon')||query.get('logo');
    const assetName=document.querySelector(section==='logos'?'#logo-detail-name':'#detail-name')?.textContent?.trim()||null;
    const common={assetId,assetName,variant:query.get('variant'),color:query.get('color')};
    if(target.matches('[data-id]'))send('icon_open',{assetId:target.dataset.id,assetName:target.querySelector('.icon-name')?.textContent?.trim()||null});
    else if(target.matches('[data-logo]'))send('logo_open',{assetId:target.dataset.logo,assetName:target.querySelector('.logo-card-head strong')?.textContent?.trim()||null});
    else if(target.matches('#download-svg'))send('download_svg',common);
    else if(target.matches('#download-png'))send('download_png',common);
    else if(target.matches('#logo-download'))send('logo_download',common);
    else if(target.matches('#copy-svg'))send('copy_svg',common);
    else if(target.matches('#copy-link'))send('copy_link',common);
    else if(target.matches('.figma-link,#logo-figma,.source-cta'))send('figma_open',common);
  });
})();
