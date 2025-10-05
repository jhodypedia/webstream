// ================================
// ⚙️ PANSA ADMIN DASHBOARD SCRIPT
// ================================

const socket = io(); // for realtime jobs
Dropzone.autoDiscover = false;

$(function(){
  const sidebar = document.querySelector('.sidebar');
  const toggleBtns = document.querySelectorAll('.toggle-sidebar, .sidebar .toggle-btn');

  // === Sidebar open/close (desktop & mobile)
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebar.classList.toggle('closed');
    });
  });

  // Highlight active menu
  const current = location.pathname;
  $('.menu-item').each(function(){
    const href = $(this).attr('href');
    if (href && current.startsWith(href)) $(this).addClass('active');
  });

  // Init page functions
  if ($('#tblVideos').length) initVideosPage();
  if ($('#tblJobs').length) initJobsPage();
  if ($('#dzUpload').length) initUploadPage();
  if ($('#formSettings').length) initSettingsPage();

  // Realtime jobs events
  socket.on('job:progress', ()=> bump('#statJobsRunning', 0));
  socket.on('job:completed', ()=> bump('#statJobsRunning', -1));
  socket.on('job:failed', ()=> bump('#statJobsRunning', -1));
});

function bump(sel, delta){
  const el = document.querySelector(sel);
  if(!el) return;
  const n = parseInt(el.textContent || '0', 10) + (delta||0);
  el.textContent = Math.max(n,0);
}

/* ===================================================
   📹 Videos Page
=================================================== */
function initVideosPage(){
  const $table = $('#tblVideos');
  const $modal = $('#modalVideo');
  const $form = $('#formVideo');
  let datatable;

  function showLoader(){
    $('body').append(`<div id="loader" class="loading-overlay"><div class="spinner"></div></div>`);
  }
  function hideLoader(){ $('#loader').remove(); }

  function loadTable(){
    showLoader();
    $.get('/admin/api/videos').done(res=>{
      hideLoader();
      const rows = (res.items||[]).map(v=>{
        const thumb = v.thumbnail_url
          ? `<img src="${v.thumbnail_url}" style="width:80px;height:45px;object-fit:cover;border-radius:6px">`
          : `<div style="width:80px;height:45px;background:#222;border-radius:6px"></div>`;
        const created = new Date(v.createdAt).toLocaleString('id-ID');
        return [
          thumb,
          `<div><strong>${escapeHtml(v.title||'-')}</strong><div style="color:#9aa7b6;font-size:12px">${v.slug}</div></div>`,
          v.status,
          v.views || 0,
          created,
          `
            <div style="display:flex;gap:6px">
              <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${v.id}"><i class="fa fa-edit"></i></button>
              <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${v.id}"><i class="fa fa-trash"></i></button>
              <a class="btn btn-primary btn-sm" href="/watch/${v.slug}" target="_blank"><i class="fa fa-play"></i></a>
            </div>`
        ];
      });

      if (datatable){
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
          responsive: true,
          destroy: true,
          language: {
            search: "_INPUT_",
            searchPlaceholder: "Search videos..."
          }
        });
      }
    }).fail(()=> hideLoader());
  }

  loadTable();

  $('#btnCreateVideo').on('click', ()=> openVideoModal());
  $('#tblVideos tbody').on('click','button',function(){
    const id = this.dataset.id;
    const action = this.dataset.action;
    if (action==='edit') openVideoModal(id);
    if (action==='delete') deleteVideo(id, loadTable);
  });

  $('#btnCancelModal').on('click', ()=> $modal.attr('hidden','hidden'));

  $form.on('submit', function(e){
    e.preventDefault();
    const d = Object.fromEntries(new FormData(this).entries());
    const payload = {
      title: d.title, description: d.description,
      hls_master_url: d.hls_master_url, thumbnail_url: d.thumbnail_url, status: d.status
    };
    const method = d.id ? 'PUT' : 'POST';
    const url = d.id ? '/admin/api/videos/'+d.id : '/admin/api/videos';

    $.ajax({ url, method, contentType:'application/json', data:JSON.stringify(payload) })
    .done(res=>{
      if(res.ok){
        Swal.fire({
          title:'Success',
          text:'Video saved successfully',
          icon:'success',
          showConfirmButton:false,
          timer:1400
        });
        $modal.attr('hidden','hidden');
        loadTable();
      } else {
        Swal.fire('Error',res.error||'Failed','error');
      }
    });
  });

  function openVideoModal(id){
    $('#formVideo')[0].reset();
    $('#formVideo [name=id]').val('');
    $('#modalTitle').text(id ? 'Edit Video' : 'Create Video');
    if(!id) return $modal.removeAttr('hidden');
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
}

function deleteVideo(id,onDone){
  Swal.fire({
    title:'Delete this video?',
    icon:'warning',
    showCancelButton:true,
    confirmButtonText:'Yes, delete it!'
  }).then(r=>{
    if(!r.isConfirmed) return;
    $.ajax({ url:'/admin/api/videos/'+id, method:'DELETE' }).done(res=>{
      if(res.ok){
        Swal.fire('Deleted','Video removed','success');
        onDone&&onDone();
      } else Swal.fire('Error',res.error||'Failed','error');
    });
  });
}

/* ===================================================
   ☁️ Upload Page
=================================================== */
function initUploadPage(){
  if (Dropzone.instances.length) Dropzone.instances.forEach(dz=>dz.destroy());
  const dz = new Dropzone("#dzUpload", {
    url: "/admin/api/upload",
    maxFilesize: 2048, // 2GB
    acceptedFiles: ".mp4,.mov,.mkv",
    parallelUploads: 1,
    timeout: 0,
    dictDefaultMessage: "📁 Drop file di sini atau klik untuk memilih",
    init: function(){
      this.on("success",(file,res)=>{
        if(res && res.ok){
          Swal.fire('Queued','Upload diterima dan diproses','success');
        } else {
          Swal.fire('Error',res.error||'Gagal upload','error');
        }
      });
      this.on("error",(file,msg)=>{
        Swal.fire('Error',msg,'error');
      });
    }
  });
}

/* ===================================================
   🧩 Jobs Page
=================================================== */
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
      if(datatable){
        datatable.clear(); datatable.rows.add(rows).draw();
      } else {
        datatable = $table.DataTable({
          data: rows,
          columns: [
            { title: "Video ID" },
            { title: "Type" },
            { title: "Status" },
            { title: "Progress" },
            { title: "Updated" }
          ],
          pageLength: 10,
          responsive: true,
          destroy: true
        });
      }
    });
  }

  loadJobs();
  socket.on('job:progress', ()=> loadJobs());
  socket.on('job:completed', ()=> loadJobs());
  socket.on('job:failed', ()=> loadJobs());
}

/* ===================================================
   ⚙️ Settings Page
=================================================== */
function initSettingsPage(){
  $('#formSettings').on('submit', function(e){
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(this).entries());
    fetch('/admin/api/settings', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(r=>r.json())
    .then(res=>{
      if(res.ok){
        Swal.fire({
          icon:'success',
          title:'Saved',
          text:'Settings updated & reloaded',
          timer:1500,
          showConfirmButton:false
        });
      } else Swal.fire('Error',res.error||'Failed','error');
    });
  });
}

/* ===================================================
   🧠 Utility
=================================================== */
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// Loader effect style
if(!document.querySelector('#admin-loader-style')){
  const style = document.createElement('style');
  style.id='admin-loader-style';
  style.textContent = `
  .loading-overlay {
    position: fixed; inset:0; background:rgba(0,0,0,.6);
    display:grid; place-items:center; z-index:9999;
    animation: fadeIn .3s ease;
  }
  .spinner {
    width: 50px; height: 50px;
    border: 4px solid rgba(255,255,255,.2);
    border-top-color: var(--admin-accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {to {transform: rotate(360deg);}}
  `;
  document.head.appendChild(style);
}
