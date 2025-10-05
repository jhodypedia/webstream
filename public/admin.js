// ================================
// ⚙️ PANSA ADMIN DASHBOARD SCRIPT (FINAL)
// ================================

const socket = io();
Dropzone.autoDiscover = false;

$(function(){
  const sidebar = document.querySelector('.sidebar');
  const toggleBtns = document.querySelectorAll('.toggle-sidebar, .sidebar .toggle-btn');

  // === Sidebar toggle (desktop & mobile)
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

  // Realtime events
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
   📹 VIDEOS PAGE
=================================================== */
function initVideosPage(){
  const $table = $('#tblVideos');
  const $modal = $('#modalVideo');
  const $form = $('#formVideo');
  let datatable;

  // Loader
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
          ? `<img src="${v.thumbnail_url}" class="vid-thumb">`
          : `<div class="vid-thumb placeholder"></div>`;
        const created = new Date(v.createdAt).toLocaleString('id-ID');
        return [
          thumb,
          `<div class="vid-meta"><strong>${escapeHtml(v.title||'-')}</strong><div class="vid-slug">${v.slug}</div></div>`,
          `<span class="badge status-${v.status}">${v.status}</span>`,
          v.views || 0,
          created,
          `
          <div class="tbl-actions">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${v.id}" title="Edit"><i class="fa fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm danger" data-action="delete" data-id="${v.id}" title="Delete"><i class="fa fa-trash"></i></button>
            <a class="btn btn-primary btn-sm" href="/watch/${v.slug}" target="_blank" title="View"><i class="fa fa-play"></i></a>
          </div>`
        ];
      });

      if (datatable){
        datatable.clear(); datatable.rows.add(rows).draw();
      } else {
        datatable = $table.DataTable({
          data: rows,
          pageLength: 10,
          responsive: true,
          destroy: true,
          columns: [
            { title: 'Thumb' },
            { title: 'Title' },
            { title: 'Status' },
            { title: 'Views' },
            { title: 'Created' },
            { title: 'Actions', orderable: false }
          ],
          language: {
            search: "_INPUT_",
            searchPlaceholder: "Search videos..."
          },
          createdRow: (row) => {
            $(row).addClass('row-animate');
          }
        });
      }
    }).fail(()=> hideLoader());
  }

  loadTable();

  // Create video
  $('#btnCreateVideo').on('click', ()=> openVideoModal());

  // Edit/Delete
  $('#tblVideos tbody').on('click','button',function(){
    const id = this.dataset.id;
    const action = this.dataset.action;
    if (action==='edit') openVideoModal(id);
    if (action==='delete') deleteVideo(id, loadTable);
  });

  $('#btnCancelModal, #btnCloseModal').on('click', ()=> closeModal());

  // Submit form
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
          icon:'success',
          title:'Saved!',
          text:'Video updated successfully',
          showConfirmButton:false,
          timer:1400
        });
        closeModal();
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
    if(!id) return showModal();
    $.get('/admin/api/videos').done(res=>{
      const it = (res.items||[]).find(x=>x.id===id);
      if(!it) return;
      $('#formVideo [name=id]').val(it.id);
      $('#formVideo [name=title]').val(it.title||'');
      $('#formVideo [name=description]').val(it.description||'');
      $('#formVideo [name=hls_master_url]').val(it.hls_master_url||'');
      $('#formVideo [name=thumbnail_url]').val(it.thumbnail_url||'');
      $('#formVideo [name=status]').val(it.status||'ready');
      showModal();
    });
  }

  function showModal(){
    $modal.fadeIn(200).removeAttr('hidden');
    $('.admin-modal__body').addClass('animate__fadeInUp');
  }
  function closeModal(){
    $modal.fadeOut(150, ()=> $modal.attr('hidden','hidden'));
  }
}

function deleteVideo(id,onDone){
  Swal.fire({
    title:'Delete this video?',
    text:'This action cannot be undone!',
    icon:'warning',
    showCancelButton:true,
    confirmButtonText:'Yes, delete it!',
    confirmButtonColor:'#e74c3c'
  }).then(r=>{
    if(!r.isConfirmed) return;
    $.ajax({ url:'/admin/api/videos/'+id, method:'DELETE' }).done(res=>{
      if(res.ok){
        Swal.fire('Deleted!','Video removed','success');
        onDone&&onDone();
      } else Swal.fire('Error',res.error||'Failed','error');
    });
  });
}

/* ===================================================
   ☁️ UPLOAD PAGE
=================================================== */
function initUploadPage(){
  if (Dropzone.instances.length) Dropzone.instances.forEach(dz=>dz.destroy());
  const dz = new Dropzone("#dzUpload", {
    url: "/admin/api/upload",
    maxFilesize: 2048,
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
   🧩 JOBS PAGE
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
          pageLength: 10,
          responsive: true,
          destroy: true,
          columns: [
            { title: "Video ID" },
            { title: "Type" },
            { title: "Status" },
            { title: "Progress" },
            { title: "Updated" }
          ]
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
   ⚙️ SETTINGS PAGE
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
          text:'Settings updated successfully',
          timer:1500,
          showConfirmButton:false
        });
      } else Swal.fire('Error',res.error||'Failed','error');
    });
  });
}

/* ===================================================
   🧠 UTILITIES
=================================================== */
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// Custom loader + Datatable glow
if(!document.querySelector('#admin-extra-style')){
  const style = document.createElement('style');
  style.id='admin-extra-style';
  style.textContent = `
  .loading-overlay {
    position: fixed; inset:0; background:rgba(0,0,0,.7);
    display:grid; place-items:center; z-index:9999;
    animation: fadeIn .3s ease;
  }
  .spinner {
    width: 60px; height: 60px;
    border: 4px solid rgba(255,255,255,.2);
    border-top-color: var(--admin-accent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {to {transform: rotate(360deg);}}
  @keyframes rowFade {from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .row-animate {animation:rowFade .3s ease;}
  .vid-thumb{width:80px;height:45px;object-fit:cover;border-radius:6px;box-shadow:0 0 8px rgba(0,0,0,.3);}
  .vid-thumb.placeholder{background:#222;}
  .vid-meta strong{color:#fff;font-weight:600;}
  .vid-slug{color:#aaa;font-size:12px;}
  .tbl-actions{display:flex;gap:6px;justify-content:center;}
  .badge{padding:4px 8px;border-radius:6px;font-size:12px;text-transform:capitalize;}
  .status-ready{background:rgba(91,255,168,.15);color:#6bffa0;}
  .status-uploaded{background:rgba(255,230,91,.15);color:#ffe95b;}
  .status-failed{background:rgba(255,91,91,.15);color:#ff6161;}
  table.dataTable tbody tr:hover{background:rgba(255,255,255,.05);}
  table.dataTable thead th{color:#6be2ff;}
  `;
  document.head.appendChild(style);
}
