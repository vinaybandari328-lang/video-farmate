(function () {
  const state = {
    bgType: 'gradient',
    fontColor: 'white',
    fontSize: 'medium',
    aspect: '9:16',
  };

  const quoteText = document.getElementById('quoteText');
  const wordCount = document.getElementById('wordCount');
  const bgTypeSeg = document.getElementById('bgTypeSeg');
  const color2Field = document.getElementById('color2Field');
  const fontSizeSeg = document.getElementById('fontSizeSeg');
  const fontColorSwatches = document.getElementById('fontColorSwatches');
  const aspectGrid = document.getElementById('aspectGrid');
  const textBackground = document.getElementById('textBackground');
  const generateBtn = document.getElementById('generateBtn');
  const errorBox = document.getElementById('errorBox');
  const placeholder = document.getElementById('placeholder');
  const previewVideo = document.getElementById('previewVideo');
  const recDot = document.getElementById('recDot');
  const timecode = document.getElementById('timecode');
  const stageStatus = document.getElementById('stageStatus');
  const downloadLink = document.getElementById('downloadLink');
  const stage = document.getElementById('stage');

  function updateWordCount() {
    const words = quoteText.value.trim().split(/\s+/).filter(Boolean);
    wordCount.textContent = words.length;
  }
  quoteText.addEventListener('input', updateWordCount);
  updateWordCount();

  function wireSeg(container, key, onChange) {
    container.querySelectorAll('[data-val]').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('[data-val]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state[key] = btn.dataset.val;
        if (onChange) onChange(btn.dataset.val);
      });
    });
  }

  wireSeg(bgTypeSeg, 'bgType', (val) => {
    color2Field.style.display = val === 'solid' ? 'none' : 'flex';
  });
  wireSeg(fontSizeSeg, 'fontSize');
  wireSeg(fontColorSwatches, 'fontColor');
  wireSeg(aspectGrid, 'aspect', (val) => {
    const ratios = { '9:16': '9/16', '1:1': '1/1', '16:9': '16/9' };
    document.getElementById('stageInner').style.aspectRatio = ratios[val];
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
  }

  let tcInterval = null;
  function startTimecode() {
    const start = Date.now();
    recDot.classList.add('rendering');
    stageStatus.textContent = 'RENDERING';
    tcInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const totalFrames = Math.floor(elapsed / (1000 / 30));
      const frames = totalFrames % 30;
      const totalSec = Math.floor(totalFrames / 30);
      const sec = totalSec % 60;
      const min = Math.floor(totalSec / 60);
      const pad = (n) => String(n).padStart(2, '0');
      timecode.textContent = `00:${pad(min)}:${pad(sec)}:${pad(frames)}`;
    }, 33);
  }
  function stopTimecode(ok) {
    clearInterval(tcInterval);
    recDot.classList.remove('rendering');
    stageStatus.textContent = ok ? 'READY' : 'ERROR';
  }

  generateBtn.addEventListener('click', async () => {
    clearError();
    const text = quoteText.value.trim();
    if (!text) {
      showError('Type in some text first.');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Rendering…';
    downloadLink.hidden = true;
    startTimecode();

    const payload = {
      text,
      aspect: state.aspect,
      bgType: state.bgType,
      color1: document.getElementById('color1').value,
      color2: document.getElementById('color2').value,
      fontColor: state.fontColor,
      fontSize: state.fontSize,
      textBackground: textBackground.checked,
    };

    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Something went wrong.');

      placeholder.hidden = true;
      previewVideo.hidden = false;
      previewVideo.src = data.url;
      previewVideo.load();
      previewVideo.play().catch(() => {});

      downloadLink.href = data.url;
      downloadLink.hidden = false;
      stopTimecode(true);
    } catch (err) {
      showError(err.message);
      stopTimecode(false);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate video';
    }
  });
})();
