// public/admin.js
const socket = io(); // for realtime jobs/dashboard

$(function(){
  // PAGE HOOKS
  if ($('#tblVideos').length) initVideosPage();
  if ($('#tblJobs').length) initJobsPage();
  if ($('#dzUpload').length) initUploadPage();
  if ($('#formSettings').length) initSettingsPage();

  // Realtime dashboard counters (optional: server can emit aggregates)
  socket.on('job:completed', () => { bump('#statJobsRunning', -1); });
  socket.on('job:failed', () => { bump('#statJobsRunning', -1); });
  socket.on('job:progress', () => { /* could update live */ });
});

function bump(sel, delta) {
  const el = document.querySelector(sel);
  if (!el) return;
  const n = parseInt(el.textContent||'0',10) + (delta||0);
  el.textContent = Math.max(n, 0);
}

/* ===== Videos ===== */
function initVideosPage() {
  const $table = $('#tblVideos');
  const $modal = $('#modalVideo');
  const $form = $('#formVideo');
  let datatable;

  function loadTable() {
    $.get('/admin/api/videos').done(res=>{
      const rows = (res.items||[]).map(v=>{
        const thumb = v.thumbnail_url ? `<img src="${v.thumbnail_url}" style="width:80px;height:45px;object-fit:cover;border-radius:6px">` : '-';
        const created = new Date(v.createdAt).toLocaleString('id-ID');
        return [
          thumb,
          `<div><div style="font-weight:600">${escapeHtml(v.title||'-')}</div><div style="color:#9aa7b6;font-size:12px">${v.slug}</div></div>`,
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
      if (datatable) { datatable.clear(); datatable.rows.add(rows).draw(); }
      else {
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
          pageLength: 10
        });
      }
    });
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
       .done(res=>{ if(res.ok){ Swal.fire('Saved','Video updated','success'); closeVideoModal(); loadTable(); } else Swal.fire('Error',res.error||'Failed','error'); });
    } else {
      $.ajax({ url:'/admin/api/videos', method:'POST', contentType:'application/json', data:JSON.stringify(payload) })
       .done(res=>{ if(res.ok){ Swal.fire('Created','Video created','success'); closeVideoModal(); loadTable(); } else Swal.fire('Error',res.error||'Failed','error'); });
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

function deleteVideo(id, onDone){
  Swal.fire({ title:'Delete this video?', icon:'warning', showCancelButton:true }).then(r=>{
    if(!r.isConfirmed) return;
    $.ajax({ url:'/admin/api/videos/'+id, method:'DELETE' }).done(res=>{
      if(res.ok){ Swal.fire('Deleted','Video removed','success'); onDone&&onDone(); }
      else Swal.fire('Error',res.error||'Failed','error');
    });
  });
}

/* ===== Upload ===== */
function initUploadPage(){
  Dropzone.autoDiscover = false;
  const dz = new Dropzone('#dzUpload', {
    url: '/admin/api/upload',
    maxFilesize: 2048, // MB (ditentukan di server juga)
    acceptedFiles: '.mp4,.mov,.mkv',
    parallelUploads: 1,
    createImageThumbnails: false,
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

/* ===== Jobs ===== */
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
      if (datatable) { datatable.clear(); datatable.rows.add(rows).draw(); }
      else {
        datatable = $table.DataTable({
          data: rows,
          columns: [
            { title: 'Video ID' },
            { title: 'Type' },
            { title: 'Status' },
            { title: 'Progress' },
            { title: 'Updated' }
          ],
          pageLength: 10
        });
      }
    });
  }
  loadJobs();

  // Realtime via socket
  socket.on('job:progress', ()=> loadJobs());
  socket.on('job:completed', ()=> loadJobs());
  socket.on('job:failed', ()=> loadJobs());
}

/* ===== Settings ===== */
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

/* util */
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
