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
  if ($('#dashboardStats').length) initDashboardPage(); // 🆕 dashboard section

  // Realtime socket updates
  socket.on('job:progress', ()=> updateDashboard());
  socket.on('job:completed', ()=> updateDashboard());
  socket.on('job:failed', ()=> updateDashboard());
});

/* ===================================================
   🧮 DASHBOARD PAGE
=================================================== */
let dashboardTimer;

function initDashboardPage(){
  loadDashboardStats();
  dashboardTimer = setInterval(loadDashboardStats, 10000); // auto refresh 10s
}

function loadDashboardStats(){
  $.get('/admin/api/stats').done(res=>{
    if(!res.ok) return;
    animateCounter('#statVideos', res.totalVideos);
    animateCounter('#statJobsQueued', res.jobsQueued);
    animateCounter('#statJobsRunning', res.jobsRunning);
    animateCounter('#statJobsDone', res.jobsCompleted);
    animateCounter('#statJobsFailed', res.jobsFailed);
  }).fail(()=> console.warn('Failed to load dashboard stats'));
}

function animateCounter(selector, value){
  const el = document.querySelector(selector);
  if(!el) return;
  const start = parseInt(el.textContent || '0', 10);
  const end = parseInt(value || 0, 10);
  const duration = 400;
  const step = (end - start) / (duration / 16);
  let current = start;

  const tick = ()=>{
    current += step;
    if ((step > 0 && current >= end) || (step < 0 && current <= end)){
      el.textContent = end;
      return;
    }
    el.textContent = Math.round(current);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function updateDashboard(){
  clearTimeout(dashboardTimer);
  loadDashboardStats();
  dashboardTimer = setInterval(loadDashboardStats, 10000);
}

/* ===================================================
   📹 VIDEOS PAGE
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
          createdRow: (row) => $(row).addClass('row-animate')
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
  $('#btnCancelModal, #btnCloseModal').on('click', ()=> closeModal());

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
        Swal.fire({ icon:'success', title:'Saved!', timer:1400, showConfirmButton:false });
        closeModal();
        loadTable();
      } else Swal.fire('Error',res.error||'Failed','error');
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
        Swal.fire(res.ok?'Queued':'Error',res.ok?'Upload diterima dan diproses':(res.error||'Gagal upload'),res.ok?'success':'error');
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
      Swal.fire(res.ok?'Saved':'Error',res.ok?'Settings updated':'Failed to save','info');
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
