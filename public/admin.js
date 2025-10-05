// === Realtime SocketIO ===
const socket = io();

// === GLOBAL INIT ===
$(function(){
  const sidebar = document.querySelector('.sidebar');
  const toggleBtns = document.querySelectorAll('.toggle-sidebar, .sidebar .toggle-btn');

  // Sidebar toggle (mobile & desktop)
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebar.classList.toggle('closed');
    });
  });

  // Highlight active menu item
  const current = location.pathname;
  $('.menu-item').each(function(){
    const href = $(this).attr('href');
    if (href && current.startsWith(href)) $(this).addClass('active');
  });

  // PAGE INITIALIZATION
  if ($('#tblVideos').length) initVideosPage();
  if ($('#tblJobs').length) initJobsPage();
  if ($('#dzUpload').length) initUploadPage();
  if ($('#formSettings').length) initSettingsPage();

  // Realtime dashboard counters
  socket.on('job:completed', () => bump('#statJobsRunning', -1));
  socket.on('job:failed', () => bump('#statJobsRunning', -1));
  socket.on('job:progress', () => {});
});

// ===== Utility: bump number counters =====
function bump(sel, delta) {
  const el = document.querySelector(sel);
  if (!el) return;
  const n = parseInt(el.textContent || '0', 10) + (delta || 0);
  el.textContent = Math.max(n, 0);
}

// ===== Videos Page =====
function initVideosPage() {
  const $table = $('#tblVideos');
  const $modal = $('#modalVideo');
  const $form = $('#formVideo');
  let datatable;

  const showLoader = () => $('body').append('<div id="loader" class="loading-overlay"><div class="spinner"></div></div>');
  const hideLoader = () => $('#loader').remove();

  function loadTable() {
    showLoader();
    $.get('/admin/api/videos').done(res => {
      hideLoader();
      const rows = (res.items || []).map(v => {
        const thumb = v.thumbnail_url 
          ? `<img src="${v.thumbnail_url}" style="width:80px;height:45px;object-fit:cover;border-radius:6px">`
          : '<div style="width:80px;height:45px;background:#222;border-radius:6px"></div>';
        const created = new Date(v.createdAt).toLocaleString('id-ID');
        return [
          thumb,
          `<div><div style="font-weight:600">${escapeHtml(v.title || '-')}</div><div style="color:#9aa7b6;font-size:12px">${v.slug}</div></div>`,
          v.status,
          v.views || 0,
          created,
          `
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${v.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${v.id}">Delete</button>
            <a class="btn btn-primary btn-sm" href="/watch/${v.slug}" target="_blank">Open</a>
          </div>
          `
        ];
      });
      if (datatable) {
        datatable.clear(); datatable.rows.add(rows).draw();
      } else {
        datatable = $table.DataTable({
          data: rows,
          columns: [
            { title: 'Thumb' },
            { title: 'Title' },
            { title: 'Status' },
            { title: 'Views' },
            { title: 'Created' },
            { title: 'Actions', orderable: false }
          ],
          pageLength: 10,
          responsive: true
        });
      }
    }).fail(() => hideLoader());
  }
  loadTable();

  $('#btnCreateVideo').on('click', ()=> openVideoModal());
  $('#tblVideos tbody').on('click','button',function(){
    const id = this.dataset.id;
    const action = this.dataset.action;
    if (action==='edit') openVideoModal(id);
    if (action==='delete') deleteVideo(id, loadTable);
  });

  $('#btnCancelModal').on('click', ()=> closeVideoModal());
  $form.on('submit', function(e){
    e.preventDefault();
    const d = Object.fromEntries(new FormData(this).entries());
    const payload = {
      title: d.title, description: d.description,
      hls_master_url: d.hls_master_url, thumbnail_url: d.thumbnail_url, status: d.status
    };
    if (d.id) {
      $.ajax({ url:'/admin/api/videos/'+d.id, method:'PUT', contentType:'application/json', data:JSON.stringify(payload) })
       .done(res=>{ 
         if(res.ok){ Swal.fire('Saved','Video updated','success'); closeVideoModal(); loadTable(); }
         else Swal.fire('Error',res.error||'Failed','error');
       });
    } else {
      $.ajax({ url:'/admin/api/videos', method:'POST', contentType:'application/json', data:JSON.stringify(payload) })
       .done(res=>{ 
         if(res.ok){ Swal.fire('Created','Video created','success'); closeVideoModal(); loadTable(); }
         else Swal.fire('Error',res.error||'Failed','error');
       });
    }
  });

  function openVideoModal(id){
    $('#modalTitle').text(id?'Edit Video':'Create Video');
    $('#formVideo')[0].reset();
    $('#formVideo [name=id]').val('');
    if (!id) return $modal.removeAttr('hidden');
    $.get('/admin/api/videos').done(res=>{
      const it = (res.items||[]).find(x=>x.id===id);
      if(!it) return;
      $('#formVideo [name=id]').val(it.id);
      $('#formVideo [name=title]').val(it.title||'');
      $('#formVideo [name=description]').val(it.description||'');
      $('#formVideo [name=hls_master_url]').val(it.hls_master_url||'');
      $('#formVideo [name=thumbnail_url]').val(it.thumbnail_url||'');
      $('#formVideo [name=status]').val(it.status||'ready');
      $modal.removeAttr('hidden');
    });
  }
  function closeVideoModal(){ $modal.attr('hidden','hidden'); }
}

// ===== Delete Video =====
function deleteVideo(id, onDone){
  Swal.fire({ title:'Delete this video?', icon:'warning', showCancelButton:true }).then(r=>{
    if(!r.isConfirmed) return;
    $.ajax({ url:'/admin/api/videos/'+id, method:'DELETE' }).done(res=>{
      if(res.ok){ Swal.fire('Deleted','Video removed','success'); onDone&&onDone(); }
      else Swal.fire('Error',res.error||'Failed','error');
    });
  });
}

// ===== Upload Page =====
function initUploadPage(){
  if (window.__dzAttached) return; // prevent re-init
  window.__dzAttached = true;

  Dropzone.autoDiscover = false;
  const dz = new Dropzone('#dzUpload', {
    url: '/admin/api/upload',
    maxFilesize: 2048,
    acceptedFiles: '.mp4,.mov,.mkv',
    parallelUploads: 1,
    createImageThumbnails: false,
    dictDefaultMessage: `<i class="fa-solid fa-cloud-arrow-up" style="font-size:36px;color:#6be2ff;margin-bottom:10px"></i>
                         <br>Drop file di sini atau klik untuk memilih<br><small style="opacity:.7;">Format: .mp4, .mov, .mkv | Maksimum 2GB</small>`,
    init: function(){
      this.on('success', (file, res)=>{
        if(res && res.ok){
          Swal.fire('Queued', 'Upload diterima dan diproses', 'success');
        } else {
          Swal.fire('Error', (res && res.error) || 'Failed', 'error');
        }
      });
      this.on('error', (file, msg)=> Swal.fire('Error', msg, 'error'));
    }
  });
}

// ===== Jobs Page =====
function initJobsPage(){
  const $table = $('#tblJobs');
  let datatable;

  function loadJobs(){
    $.get('/admin/api/jobs').done(res=>{
      if(!res.ok) return;
      const rows = (res.items||[]).map(j=>{
        const updated = new Date(j.updatedAt || j.createdAt).toLocaleString('id-ID');
        return [ j.video_id, j.type, j.status, (j.progress||0)+'%', updated ];
      });
      if (datatable) {
        datatable.clear(); datatable.rows.add(rows).draw();
      } else {
        datatable = $table.DataTable({
          data: rows,
          columns: [
            { title: 'Video ID' },
            { title: 'Type' },
            { title: 'Status' },
            { title: 'Progress' },
            { title: 'Updated' }
          ],
          pageLength: 10,
          responsive: true
        });
      }
    });
  }
  loadJobs();

  socket.on('job:progress', ()=> loadJobs());
  socket.on('job:completed', ()=> loadJobs());
  socket.on('job:failed', ()=> loadJobs());
}

// ===== Settings Page =====
function initSettingsPage(){
  $('#formSettings').on('submit', function(e){
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(this).entries());
    fetch('/admin/api/settings', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    }).then(r=>r.json()).then(res=>{
      if(res.ok) Swal.fire('Saved','Settings updated (runtime reloaded)','success');
      else Swal.fire('Error',res.error||'Failed','error');
    }).catch(()=> Swal.fire('Error','Network error','error'));
  });
}

// ===== Utility =====
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// ===== Loader Styles =====
if (!document.querySelector('#admin-loader-style')) {
  const style = document.createElement('style');
  style.id = 'admin-loader-style';
  style.textContent = `
  .loading-overlay {position:fixed;inset:0;background:rgba(0,0,0,.5);display:grid;place-items:center;z-index:2000;}
  .spinner {width:40px;height:40px;border:4px solid rgba(255,255,255,.3);border-top-color:var(--admin-accent);border-radius:50%;animation:spin .8s linear infinite;}
  @keyframes spin {to{transform:rotate(360deg);}}
  `;
  document.head.appendChild(style);
}
