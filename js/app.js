(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { convert: null, resize: null, studio: null, studioImage: null, rotation: 0 };
  const formatBytes = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  const safeName = name => name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');

  function navigate(section) {
    if (!['convert', 'resolution', 'studio'].includes(section)) section = 'convert';
    document.body.dataset.section = section;
    $$('.experience').forEach(page => page.classList.toggle('active', page.dataset.page === section));
    $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === section));
    if (location.hash !== `#${section}`) history.replaceState(null, '', `#${section}`);
  }
  $$('.nav-item').forEach(item => item.addEventListener('click', event => { event.preventDefault(); navigate(item.dataset.route); }));
  window.addEventListener('hashchange', () => navigate(location.hash.slice(1)));
  navigate(location.hash.slice(1) || 'convert');

  function loadImage(file, callback) {
    if (!file || !file.type.startsWith('image/')) return callback(new Error('Please choose a valid image file.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => callback(null, { file, image, url, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => { URL.revokeObjectURL(url); callback(new Error('This image could not be opened by your browser.')); };
    image.src = url;
  }
  function preview(section, data) {
    const card = `#${section}-preview`;
    const node = $(card);
    if (!node) return;
    $('img', node).src = data.url;
    $('img', node).alt = data.file.name;
    $('.file-meta strong', node).textContent = data.file.name;
    $('.file-meta small', node).textContent = `${data.width} × ${data.height} px · ${formatBytes(data.file.size)}`;
    node.classList.remove('hidden');
  }
  function clearSection(section) {
    const old = state[section];
    if (old?.url) URL.revokeObjectURL(old.url);
    state[section] = null;
    $(`#${section}-preview`)?.classList.add('hidden');
    $(`#${section}-action`)?.setAttribute('disabled', '');
    const feedback = $(`#${section}-feedback`);
    if (feedback) feedback.textContent = 'Select an image to begin.';
    if (section === 'resize') {
      $('#dimension-card').classList.add('hidden');
      $('[data-preset].selected')?.classList.remove('selected');
      $('#resize-width').value = 1200; $('#resize-height').value = 800;
      $('#original-size').textContent = '—'; $('#new-size').textContent = '—';
    }
    if (section === 'studio') {
      $('#editor').classList.add('hidden'); $('#studio-drop').classList.remove('hidden');
      state.studioImage = null; state.rotation = 0;
      ['brightness','contrast','saturation'].forEach(id => { $('#'+id).value = 100; $('#'+id+'-out').textContent = '100%'; });
      $('#studio-file').value = '';
    }
  }
  $$('[data-clear]').forEach(button => button.addEventListener('click', () => clearSection(button.dataset.clear)));

  function setupDrop(section, onLoaded) {
    const input = $(`#${section}-file`), zone = $(`#${section}-drop`), feedback = $(`#${section}-feedback`);
    const receive = file => loadImage(file, (error, data) => {
      if (error) { feedback.textContent = error.message; return; }
      if (state[section]?.url) URL.revokeObjectURL(state[section].url);
      state[section] = data;
      onLoaded(data);
    });
    input.addEventListener('change', () => { if (input.files[0]) receive(input.files[0]); input.value = ''; });
    ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('dragging'); }));
    zone.addEventListener('drop', event => { const file = [...event.dataTransfer.files].find(f => f.type.startsWith('image/')); if (file) receive(file); });
  }

  setupDrop('convert', data => {
    preview('convert', data); $('#convert-action').disabled = false;
    $('#convert-feedback').textContent = 'Ready to convert. Choose your output format.';
  });
  const formatSelect = $('#convert-format');
  const qualityInput = $('#convert-quality');
  function updateQualityControl() {
    const type = formatSelect.value;
    const isSvg = type === 'image/svg+xml', isPng = type === 'image/png';
    qualityInput.disabled = isSvg || isPng;
    $('#convert-quality-value').textContent = (isSvg || isPng) ? 'N/A' : qualityInput.value + '%';
    $('#convert-quality-hint').textContent = isSvg
      ? 'SVG contains an embedded bitmap; it is not vector tracing.'
      : isPng ? 'PNG is lossless, so a quality slider does not apply.' : 'Lower quality creates a smaller file.';
  }
  formatSelect.addEventListener('change', updateQualityControl);
  updateQualityControl();
  qualityInput.addEventListener('input', event => $('#convert-quality-value').textContent = `${event.target.value}%`);
  $('#convert-action').addEventListener('click', () => {
    const data = state.convert; if (!data) return;
    const type = $('#convert-format').value, canvas = document.createElement('canvas');
    canvas.width = data.width; canvas.height = data.height;
    const context = canvas.getContext('2d');
    if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(data.image, 0, 0);

    if (type === 'image/svg+xml') {
      canvas.toBlob(blob => {
        if (!blob) { $('#convert-feedback').textContent = 'This image could not be prepared for SVG export.'; return; }
        const reader = new FileReader();
        reader.onload = () => {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${data.width}" height="${data.height}" viewBox="0 0 ${data.width} ${data.height}"><image width="${data.width}" height="${data.height}" href="${reader.result}" xlink:href="${reader.result}"/></svg>`;
          const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          download(svgBlob, `${safeName(data.file.name)}.svg`);
          $('#convert-feedback').textContent = `SVG file exported — ${formatBytes(svgBlob.size)}. The image is embedded as a bitmap.`;
        };
        reader.onerror = () => { $('#convert-feedback').textContent = 'Could not prepare the SVG file.'; };
        reader.readAsDataURL(blob);
      }, 'image/png');
      return;
    }

    canvas.toBlob(blob => {
      if (!blob) { $('#convert-feedback').textContent = 'This format could not be exported by your browser.'; return; }
      download(blob, `${safeName(data.file.name)}.${type.split('/')[1].replace('jpeg', 'jpg')}`);
      $('#convert-feedback').textContent = `Done — ${formatBytes(blob.size)} exported.`;
    }, type, Number($('#convert-quality').value) / 100);
  });

  let updatingRatio = false;
  setupDrop('resize', data => {
    preview('resize', data); $('#resize-action').disabled = false;
    $('#resize-width').value = data.width; $('#resize-height').value = data.height;
    $('#original-size').textContent = data.width + ' × ' + data.height;
    $('#dimension-card').classList.remove('hidden'); updateDimensions();
    $('#resize-feedback').textContent = 'Set your target dimensions and export.';
  });
  function updateDimensions(changed = 'width') {
    const data = state.resize; if (!data) return;
    let width = Number($('#resize-width').value), height = Number($('#resize-height').value);
    const widthValid = Number.isInteger(width) && width >= 1 && width <= 12000;
    const heightValid = Number.isInteger(height) && height >= 1 && height <= 12000;
    if ($('#keep-ratio').checked && !updatingRatio && ((changed === 'width' && widthValid) || (changed === 'height' && heightValid))) {
      updatingRatio = true;
      if (changed === 'width') height = Math.round(width * data.height / data.width);
      else width = Math.round(height * data.width / data.height);
      $('#resize-width').value = width; $('#resize-height').value = height;
      updatingRatio = false;
    }
    width = Number($('#resize-width').value); height = Number($('#resize-height').value);
    const valid = Number.isInteger(width) && Number.isInteger(height) && width >= 1 && height >= 1 && width <= 12000 && height <= 12000;
    $('#new-size').textContent = valid ? width + ' × ' + height : 'Invalid dimensions';
    $('#resize-feedback').textContent = valid ? 'Dimensions look good. Export when you’re ready.' : 'Enter whole-number dimensions between 1 and 12,000 px.';
    $('#resize-action').disabled = !valid;
  }
  $('[data-preset]').forEach(button => button.addEventListener('click', () => {
    const data = state.resize;
    if (!data) {
      $('#resize-feedback').textContent = 'Choose an image first, then pick a size preset.';
      return;
    }
    const [maxWidth, maxHeight] = button.dataset.preset.split(',').map(Number);
    const scale = Math.min(1, maxWidth / data.width, maxHeight / data.height);
    const width = Math.max(1, Math.round(data.width * scale));
    const height = Math.max(1, Math.round(data.height * scale));
    $('#resize-width').value = width;
    $('#resize-height').value = height;
    $('#keep-ratio').checked = true;
    updateDimensions();
    $('[data-preset]').forEach(item => item.classList.toggle('selected', item === button));
    $('#resize-feedback').textContent = `${button.querySelector('strong').textContent}: fitted to ${width} × ${height} px without cropping or stretching.`;
  }));
  $('#resize-width').addEventListener('input', () => {
    $('[data-preset]').forEach(item => item.classList.remove('selected'));
    updateDimensions('width');
  });
  $('#resize-height').addEventListener('input', () => {
    $('[data-preset]').forEach(item => item.classList.remove('selected'));
    updateDimensions('height');
  });
  $('#keep-ratio').addEventListener('change', () => updateDimensions('width'));
  $('#resize-action').addEventListener('click', () => {
    const data = state.resize; if (!data) return;
    const width = Number($('#resize-width').value), height = Number($('#resize-height').value);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 12000 || height > 12000) { $('#resize-feedback').textContent = 'Choose whole-number dimensions between 1 and 12,000 pixels.'; $('#resize-action').disabled = true; return; }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(data.image, 0, 0, width, height);
    canvas.toBlob(blob => { if (!blob) return; download(blob, `${safeName(data.file.name)}-${width}x${height}.png`); $('#resize-feedback').textContent = `Exported ${width} × ${height} px · ${formatBytes(blob.size)}.`; }, 'image/png');
  });

  $('#studio-change').addEventListener('click', () => $('#studio-file').click());
  $('#studio-remove').addEventListener('click', () => clearSection('studio'));
  setupDrop('studio', data => {
    $('#studio-drop').classList.add('hidden'); $('#editor').classList.remove('hidden');
    state.studioImage = data.image; state.rotation = 0;
    ['brightness', 'contrast', 'saturation'].forEach(id => { $(`#${id}`).value = 100; $(`#${id}-out`).textContent = '100%'; });
    drawEditor(); $('#studio-feedback').textContent = 'Adjust the image, then download your edit.';
  });
  function drawEditor() {
    const image = state.studioImage; if (!image) return;
    const canvas = $('#edit-canvas'), context = canvas.getContext('2d');
    const sideways = Math.abs(state.rotation % 180) === 90;
    canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
    canvas.height = sideways ? image.naturalWidth : image.naturalHeight;
    context.save(); context.translate(canvas.width / 2, canvas.height / 2); context.rotate(state.rotation * Math.PI / 180);
    context.filter = `brightness(${$('#brightness').value}%) contrast(${$('#contrast').value}%) saturate(${$('#saturation').value}%)`;
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2); context.restore();
  }
  ['brightness', 'contrast', 'saturation'].forEach(id => $(`#${id}`).addEventListener('input', event => { $(`#${id}-out`).textContent = `${event.target.value}%`; drawEditor(); }));
  $('#rotate-action').addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; drawEditor(); });
  $('#reset-action').addEventListener('click', () => { state.rotation = 0; ['brightness', 'contrast', 'saturation'].forEach(id => { $(`#${id}`).value = 100; $(`#${id}-out`).textContent = '100%'; }); drawEditor(); });
  $('#studio-export').addEventListener('click', () => $('#edit-canvas').toBlob(blob => { if (blob && state.studio) { download(blob, `${safeName(state.studio.file.name)}-edited.png`); $('#studio-feedback').textContent = 'Your edited image is ready.'; } }, 'image/png'));

  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
})();