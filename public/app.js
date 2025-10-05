(function(){
  const app = document.getElementById('app');
  const isHome = !!document.getElementById('grid');
  const isWatch = !!document.getElementById('player');

  // =============== GLOBAL SEARCH ===============
  const qEl = document.getElementById('q');
  const btnSearch = document.getElementById('btnSearch');
  if (qEl && btnSearch) {
    btnSearch.addEventListener('click', ()=> {
      const q = qEl.value.trim();
      if (isHome) doResetAndSearch(q);
      else window.location.href='/?q='+encodeURIComponent(q);
    });
    qEl.addEventListener('keydown', (e)=> {
      if (e.key === 'Enter') btnSearch.click();
    });
  }

  // =============== HOME: GRID & INFINITE SCROLL ===============
  if (isHome) {
    const grid = document.getElementById('grid');
    const sentinel = document.getElementById('sentinel');
    const chips = document.querySelectorAll('.chip');
    const btnShuffle = document.getElementById('btnShuffle');

    let page = 1, limit = 24, loading=false, done=false, currentQ = (new URLSearchParams(location.search).get('q')||'');
    if (currentQ) {
      document.getElementById('q').value = currentQ;
      chips.forEach(c=>c.classList.remove('is-active'));
    }
    loadPage();

    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if (e.isIntersecting && !loading && !done) loadPage();
      });
    }, { rootMargin:'600px' });
    io.observe(sentinel);

    chips.forEach(ch=>{
      ch.addEventListener('click', ()=>{
        chips.forEach(c=>c.classList.remove('is-active'));
        ch.classList.add('is-active');
        doResetAndSearch(ch.dataset.q||'');
      });
    });
    if (btnShuffle) {
      btnShuffle.addEventListener('click', ()=>{
        doResetAndSearch('');
        // efek acak: scroll ke random setelah load batch
        setTimeout(()=> {
          const items = grid.querySelectorAll('.card');
          if (items.length) items[Math.floor(Math.random()*items.length)].scrollIntoView({behavior:'smooth',block:'center'});
        }, 800);
      });
    }

    function doResetAndSearch(q) {
      currentQ = q;
      page = 1; done = false;
      grid.innerHTML = '';
      showSkeleton(true);
      loadPage();
      history.replaceState(null,'','/?q='+encodeURIComponent(q));
    }
    function showSkeleton(on) {
      sentinel.style.display = on ? 'block':'none';
    }
    async function loadPage() {
      loading = true;
      showSkeleton(true);
      try {
        const url = `/api/public/videos?page=${page}&limit=${limit}&q=${encodeURIComponent(currentQ)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.ok) throw new Error('Failed');

        data.items.forEach(v => grid.appendChild(card(v)));
        if (data.items.length < limit) { done = true; showSkeleton(false); }
        page++;
      } catch (e) {
        console.error(e); done = true; showSkeleton(false);
      } finally { loading = false; }
    }
    function card(v) {
      const a = document.createElement('a');
      a.href = '/watch/'+v.slug;
      a.className = 'card';
      a.innerHTML = `
        <div class="thumb">
          <div class="thumb-overlay"></div>
          <div class="thumb-label">HD</div>
        </div>
        <div class="card-meta">
          <h4 class="line-clamp-2">${escapeHtml(v.title)}</h4>
          <div class="mini"><span>${v.views} views</span></div>
        </div>`;
      // micro-hover parallax
      a.addEventListener('mousemove', (e)=>{
        const r = a.getBoundingClientRect();
        const rx = (e.clientX - r.left)/r.width, ry=(e.clientY - r.top)/r.height;
        a.style.transform = `translateY(-4px) scale(1.02) rotateX(${(ry-.5)*2}deg) rotateY(${(rx-.5)*-2}deg)`;
      });
      a.addEventListener('mouseleave', ()=> a.style.transform='');
      return a;
    }
    function escapeHtml(s){return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  }

  // =============== WATCH: sudah di page sendiri (lihat inline script) ===============
})();
