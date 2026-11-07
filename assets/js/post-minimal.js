/* Progressive enhancement for Jekyll Markdown: TOC, links, code and tables. */
(()=>{'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  // If an article was opened from the homepage dashboard, its back link
  // returns to the same lower screen, not an unrelated page or the homepage top.
  try {
    const remembered=JSON.parse(sessionStorage.getItem('portfolio-explore-return')||'null');
    if (remembered?.target === location.pathname && remembered.home) {
      const back=document.querySelector('.post-return .back-link');
      if (back) {
        back.href=remembered.home;
        back.innerHTML='<span aria-hidden="true" class="back-arrow">←</span> Back';
        back.setAttribute('aria-label','Back to home dashboard');
      }
    }
  } catch (_) {}
  const content=document.querySelector('#post-content');
  const toc=document.querySelector('#post-toc');
  if(!content) return;
  // Use the Markdown-generated headings, preserve authored IDs, ensure uniqueness.
  const headings=Array.from(content.querySelectorAll('h2,h3'));
  const used=new Set(Array.from(document.querySelectorAll('[id]')).map(el=>el.id));
  const slugify=(s)=>s.trim().toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const tocLinks=[];
  headings.forEach((heading,index)=>{
    if(!heading.id){let base=slugify(heading.textContent)||`section-${index+1}`;let id=base,n=2;while(used.has(id))id=`${base}-${n++}`;heading.id=id;used.add(id);}
    if(toc){const a=document.createElement('a');a.href='#'+encodeURIComponent(heading.id);a.className='toc-link';a.dataset.level=heading.tagName.substring(1);a.textContent=heading.textContent.trim();toc.appendChild(a);tocLinks.push(a);}
    const anchor=document.createElement('a');anchor.className='heading-anchor';anchor.href='#'+encodeURIComponent(heading.id);anchor.textContent='#';anchor.setAttribute('aria-label',`'${heading.textContent.trim()}' 위치 링크`);heading.appendChild(anchor);
  });
  const section=document.querySelector('#toc-section');
  if(!headings.length){
    if(section)section.hidden=true;
  }else if(tocLinks.length){
    const rail=document.querySelector('.aside-inner');
    const compactToc=window.matchMedia('(max-width:1120px)');
    let activeIndex=-1;
    // Use the heading nearest the reading position, not the middle of the page.
    // At the page bottom mark the last heading even if it cannot reach that line.
    const currentHeadingIndex=()=>{
      const marker=Math.min(156,Math.max(84,window.innerHeight*0.20));
      let index=0;
      headings.forEach((heading,i)=>{
        if(heading.getBoundingClientRect().top<=marker)index=i;
      });
      const doc=document.scrollingElement||document.documentElement;
      if(doc.scrollTop+window.innerHeight>=doc.scrollHeight-4)index=headings.length-1;
      return index;
    };
    // Keep the *active TOC link* visible inside an independently scrollable rail.
    // Never use scrollIntoView here: it would also move the article itself.
    const keepLinkVisible=(link)=>{
      if(!rail||compactToc.matches)return;
      const box=rail.getBoundingClientRect();
      const item=link.getBoundingClientRect();
      const padding=12;
      if(item.top<box.top+padding)rail.scrollTop+=item.top-box.top-padding;
      else if(item.bottom>box.bottom-padding)rail.scrollTop+=item.bottom-box.bottom+padding;
    };
    const updateActive=()=>{
      const next=currentHeadingIndex();
      if(next===activeIndex)return;
      activeIndex=next;
      tocLinks.forEach((link,index)=>{
        const active=index===next;
        link.classList.toggle('is-active',active);
        if(active)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
      keepLinkVisible(tocLinks[next]);
    };
    let scheduled=false;
    const scheduleActive=()=>{
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;updateActive();});
    };
    window.addEventListener('scroll',scheduleActive,{passive:true});
    window.addEventListener('resize',scheduleActive,{passive:true});
    window.addEventListener('hashchange',scheduleActive);
    tocLinks.forEach(link=>link.addEventListener('click',()=>{
      // Hash and smooth scrolling are asynchronous; the scroll listener updates
      // the highlight at each actual position, rather than on click alone.
      scheduleActive();
    }));
    updateActive();
  }
  // Reveal section headings once as the reader scrolls. Body paragraphs never move.
  // With JS disabled, headings remain visible with no hidden-state dependency.
  const mayAnimateHeadings = 'IntersectionObserver' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (mayAnimateHeadings) {
    const observed = Array.from(content.querySelectorAll('h2,h3'));
    const reveal = new IntersectionObserver((entries, observer)=>{
      entries.forEach(entry=>{
        entry.target.classList.toggle('is-visible',entry.isIntersecting);
      });
    }, {threshold:0.05, rootMargin:'0px 0px -8% 0px'});
    observed.forEach(heading=>{
      heading.classList.add('scroll-enter-heading');
      reveal.observe(heading);
    });
  }
  // Wrap Markdown tables so narrow displays can scroll horizontally.
  content.querySelectorAll('table').forEach(table=>{
    if(table.parentElement.classList.contains('table-shell'))return;
    const shell=document.createElement('div');shell.className='table-shell';shell.tabIndex=0;shell.setAttribute('role','region');shell.setAttribute('aria-label','좌우로 이동 가능한 표');table.parentNode.insertBefore(shell,table);shell.appendChild(table);
  });
  // Support Rouge .highlighter-rouge .highlight pre and plain fenced pre > code.
  content.querySelectorAll('pre').forEach(pre=>{
    if(pre.closest('.code-shell'))return;
    const high=pre.parentElement;
    const highwrap=high.classList.contains('highlight')?high:pre;
    const container=(highwrap.parentElement&&highwrap.parentElement.classList.contains('highlighter-rouge'))?highwrap.parentElement:highwrap;
    const shell=document.createElement('div');shell.className='code-shell';
    container.parentNode.insertBefore(shell,container);shell.appendChild(container);
    const code=pre.querySelector('code');
    const langClass=[code?.className||'',container.className||'',highwrap.className||''].join(' ');
    const matched=langClass.match(/(?:language-|lang-)([\w+#.-]+)/);
    const toolbar=document.createElement('div');toolbar.className='code-toolbar';
    const label=document.createElement('span');label.className='code-label';label.textContent=(matched?matched[1]:'CODE').toUpperCase();toolbar.appendChild(label);
    const btn=document.createElement('button');btn.type='button';btn.className='copy-code';btn.textContent='복사';btn.setAttribute('aria-label','코드 복사');
    const raw=pre.textContent;
    btn.addEventListener('click',async()=>{
      try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(raw);}else{
        const field=document.createElement('textarea');field.value=raw;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('copy');
      }btn.textContent='복사됨';}catch{btn.textContent='복사 실패';}
      setTimeout(()=>{btn.textContent='복사';},1800);
    });
    toolbar.appendChild(btn);shell.insertBefore(toolbar,shell.firstChild);
  });
  // On narrow screens place the same-category links after the article,
  // not above its body. Restore the sticky right rail on wider screens.
  const related=document.querySelector('.related-section');
  const asideInner=document.querySelector('.aside-inner');
  const end=document.querySelector('.post-end');
  const layout=document.querySelector('.post-layout');
  const compact=window.matchMedia('(max-width:1120px)');
  if(related&&asideInner&&end&&layout){
    const positionRelated=()=>{
      if(compact.matches){layout.insertBefore(related,end);related.classList.add('related-mobile');}
      else {asideInner.appendChild(related);related.classList.remove('related-mobile');}
    };
    positionRelated();
    if(compact.addEventListener)compact.addEventListener('change',positionRelated);
    else compact.addListener(positionRelated);
  }
});
})();
