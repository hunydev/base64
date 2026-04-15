const schemes = {
  base16: { label: 'Base16 (Hex)', alphabet: '0123456789ABCDEF', padded: false },
  base32: { label: 'Base32 (RFC4648)', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', padded: true, padChar: '=' },
  base58: { label: 'Base58 (Bitcoin)', alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', padded: false },
  base62: { label: 'Base62', alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', padded: false },
  base64: { label: 'Base64 (RFC4648)', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', padded: true, padChar: '=' },
  base64url: { label: 'Base64 URL-safe', alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', padded: false },
  base85: { label: 'Base85 (Ascii85 alphabet)', alphabet: (() => {
    let s = '';
    for (let i = 33; i <= 117; i += 1) s += String.fromCharCode(i);
    return s;
  })(), padded: false }
};

const rawTypes = [
  { key: 'text', label: 'Text (UTF-8)' },
  { key: 'hex', label: 'Hex bytes' },
  { key: 'binary', label: 'Binary bits (010101...)' }
];

const baseTypes = [{ key: 'basexx', label: 'BaseXX string' }];

const els = {
  mode: document.getElementById('mode'),
  inputType: document.getElementById('inputType'),
  outputType: document.getElementById('outputType'),
  baseScheme: document.getElementById('baseScheme'),
  input: document.getElementById('input'),
  output: document.getElementById('output'),
  strictMode: document.getElementById('strictMode'),
  status: document.getElementById('status'),
  fileInput: document.getElementById('fileInput'),
  mimeTypeWrap: document.getElementById('mimeTypeWrap'),
  mimeType: document.getElementById('mimeType'),
  pasteExample: document.getElementById('pasteExample'),
  clearInput: document.getElementById('clearInput'),
  copyOutput: document.getElementById('copyOutput'),
  downloadOutput: document.getElementById('downloadOutput'),
  downloadBinary: document.getElementById('downloadBinary'),
  previewBinary: document.getElementById('previewBinary'),
  previewArea: document.getElementById('previewArea'),
  previewContent: document.getElementById('previewContent')
};

let decodedBinaryState = null;

function fillSelect(select, options) {
  select.innerHTML = options.map((o) => `<option value="${o.key}">${o.label}</option>`).join('');
}

function init() {
  fillSelect(els.baseScheme, Object.entries(schemes).map(([key, value]) => ({ key, label: value.label })));
  syncMode();
  bindEvents();
  convert();
}

function syncMode() {
  if (els.mode.value === 'toBase') {
    fillSelect(els.inputType, rawTypes);
    fillSelect(els.outputType, baseTypes);
  } else {
    fillSelect(els.inputType, baseTypes);
    fillSelect(els.outputType, rawTypes);
    els.outputType.value = 'text';
  }
  syncBinaryActions();
}

function bindEvents() {
  ['mode', 'inputType', 'outputType', 'baseScheme', 'input', 'strictMode', 'mimeType'].forEach((key) => {
    els[key].addEventListener('input', key === 'mode' ? () => {
      syncMode();
      convert();
    } : convert);
    els[key].addEventListener('change', key === 'mode' ? () => {
      syncMode();
      convert();
    } : convert);
  });

  els.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (els.mode.value === 'toBase' && (els.baseScheme.value === 'base64' || els.baseScheme.value === 'base64url')) {
      els.inputType.value = 'binary';
      els.input.value = [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
      convert();
      setStatus(`파일 "${file.name}" 업로드 완료. ${els.baseScheme.value.toUpperCase()} 인코딩 결과를 확인하세요.`);
      return;
    }

    els.input.value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (els.mode.value !== 'toBase') els.mode.value = 'toBase';
    syncMode();
    els.inputType.value = 'hex';
    convert();
  });

  els.pasteExample.addEventListener('click', () => {
    if (els.mode.value === 'toBase') {
      els.inputType.value = 'text';
      els.input.value = 'BaseXX converter by hunydev';
    } else {
      els.input.value = 'QmFzZVhYIGNvbnZlcnRlciBieSBodW55ZGV2';
    }
    convert();
  });

  els.clearInput.addEventListener('click', () => {
    els.input.value = '';
    convert();
  });

  els.copyOutput.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(els.output.value);
      setStatus('결과를 클립보드에 복사했습니다.');
    } catch {
      setStatus('클립보드 복사에 실패했습니다.', true);
    }
  });

  els.downloadOutput.addEventListener('click', () => {
    const blob = new Blob([els.output.value], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `converted-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.downloadBinary.addEventListener('click', () => {
    if (!decodedBinaryState) return;
    const a = document.createElement('a');
    a.href = decodedBinaryState.url;
    a.download = `decoded-${Date.now()}`;
    a.click();
  });

  els.previewBinary.addEventListener('click', () => {
    if (!decodedBinaryState) return;
    const { url, mimeType } = decodedBinaryState;
    renderPreview(url, mimeType);
  });
}

function normalizeInput(str, strict) {
  return strict ? str : str.replace(/\s+/g, '');
}

function bytesFromRaw(value, type) {
  if (type === 'text') return new TextEncoder().encode(value);

  if (type === 'hex') {
    const clean = value.replace(/\s+/g, '');
    if (clean.length % 2 !== 0) throw new Error('Hex 문자열 길이는 짝수여야 합니다.');
    if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex 문자열에 유효하지 않은 문자가 있습니다.');
    return Uint8Array.from(clean.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  }

  if (type === 'binary') {
    const clean = value.replace(/\s+/g, '');
    if (!/^[01]*$/.test(clean)) throw new Error('Binary 입력은 0과 1만 허용됩니다.');
    if (clean.length % 8 !== 0) throw new Error('Binary 비트 길이는 8의 배수여야 합니다.');
    const arr = [];
    for (let i = 0; i < clean.length; i += 8) {
      arr.push(parseInt(clean.slice(i, i + 8), 2));
    }
    return Uint8Array.from(arr);
  }

  throw new Error('지원하지 않는 입력 포맷입니다.');
}

function rawFromBytes(bytes, type) {
  if (type === 'text') return new TextDecoder().decode(bytes);
  if (type === 'hex') return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (type === 'binary') return [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
  throw new Error('지원하지 않는 출력 포맷입니다.');
}

function encodeBase(bytes, schemeKey) {
  const scheme = schemes[schemeKey];
  if (!scheme) throw new Error('지원하지 않는 Base 스킴입니다.');
  const { alphabet, padded, padChar = '=' } = scheme;

  if (schemeKey === 'base64') {
    let out = btoa(String.fromCharCode(...bytes));
    return out;
  }

  if (schemeKey === 'base64url') {
    let out = btoa(String.fromCharCode(...bytes));
    return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  if (schemeKey === 'base32') {
    const bits = [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
    let out = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, '0');
      out += alphabet[parseInt(chunk, 2)];
    }
    if (padded) {
      while (out.length % 8 !== 0) out += padChar;
    }
    return out;
  }

  if (bytes.length === 0) return '';

  let intVal = 0n;
  for (const b of bytes) intVal = (intVal << 8n) + BigInt(b);

  const base = BigInt(alphabet.length);
  let out = '';
  while (intVal > 0n) {
    const mod = Number(intVal % base);
    out = alphabet[mod] + out;
    intVal /= base;
  }

  for (const b of bytes) {
    if (b === 0) out = alphabet[0] + out;
    else break;
  }

  return out || alphabet[0];
}

function decodeBase(input, schemeKey, strict = false) {
  const scheme = schemes[schemeKey];
  if (!scheme) throw new Error('지원하지 않는 Base 스킴입니다.');
  const { alphabet } = scheme;

  let value = normalizeInput(input, strict);
  if (value === '') return new Uint8Array();

  if (schemeKey === 'base64') {
    if (!strict) value = value.replace(/\s+/g, '');
    const bin = atob(value);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  if (schemeKey === 'base64url') {
    value = value.replace(/-/g, '+').replace(/_/g, '/');
    while (value.length % 4 !== 0) value += '=';
    const bin = atob(value);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  if (schemeKey === 'base32') {
    value = value.replace(/=+$/g, '').toUpperCase();
    const map = new Map([...alphabet].map((ch, i) => [ch, i]));
    let bits = '';
    for (const ch of value) {
      if (!map.has(ch)) throw new Error(`Base32에 유효하지 않은 문자: ${ch}`);
      bits += map.get(ch).toString(2).padStart(5, '0');
    }
    const out = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      out.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Uint8Array.from(out);
  }

  const map = new Map([...alphabet].map((ch, idx) => [ch, idx]));
  const base = BigInt(alphabet.length);

  let intVal = 0n;
  for (const ch of value) {
    const idx = map.get(ch);
    if (idx === undefined) throw new Error(`유효하지 않은 문자: ${ch}`);
    intVal = intVal * base + BigInt(idx);
  }

  const bytes = [];
  while (intVal > 0n) {
    bytes.push(Number(intVal & 255n));
    intVal >>= 8n;
  }
  bytes.reverse();

  let leadingZeros = 0;
  for (const ch of value) {
    if (ch === alphabet[0]) leadingZeros += 1;
    else break;
  }

  const out = new Uint8Array(leadingZeros + bytes.length);
  out.set(bytes, leadingZeros);
  return out;
}

function convert() {
  resetDecodedBinaryState();
  try {
    const mode = els.mode.value;
    const inputType = els.inputType.value;
    const outputType = els.outputType.value;
    const baseScheme = els.baseScheme.value;
    const strict = els.strictMode.checked;
    const input = els.input.value;

    let out = '';

    if (mode === 'toBase') {
      const bytes = bytesFromRaw(input, inputType);
      out = encodeBase(bytes, baseScheme);
    } else {
      const bytes = decodeBase(input, baseScheme, strict);
      if (isBinaryDownloadMode(mode, baseScheme)) {
        prepareDecodedBinary(bytes, resolveMimeType());
        out = `디코딩된 바이너리 준비 완료 (${bytes.length} bytes)\n"Binary 다운로드" 버튼을 사용하세요.`;
      } else {
        out = rawFromBytes(bytes, outputType);
      }
    }

    els.output.value = out;
    setStatus(`성공: ${mode === 'toBase' ? '인코딩' : '디코딩'} 완료 (${baseScheme}).`);
  } catch (error) {
    els.output.value = '';
    setStatus(`오류: ${error.message}`, true);
  }
  syncBinaryActions();
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle('error', isError);
}

function isBinaryDownloadMode(mode, scheme) {
  return mode === 'fromBase' && (scheme === 'base64' || scheme === 'base64url');
}

function resolveMimeType() {
  const mime = els.mimeType.value.trim();
  return mime || 'application/octet-stream';
}

function syncBinaryActions() {
  const enabled = isBinaryDownloadMode(els.mode.value, els.baseScheme.value);
  els.downloadBinary.hidden = !enabled;
  els.previewBinary.hidden = !enabled;
  els.mimeTypeWrap.hidden = !enabled;
  els.downloadOutput.hidden = enabled;
  els.copyOutput.disabled = enabled;
}

function resetDecodedBinaryState() {
  if (decodedBinaryState?.url) URL.revokeObjectURL(decodedBinaryState.url);
  decodedBinaryState = null;
  els.previewArea.hidden = true;
  els.previewContent.innerHTML = '';
}

function prepareDecodedBinary(bytes, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  decodedBinaryState = {
    mimeType,
    url: URL.createObjectURL(blob)
  };
}

function renderPreview(url, mimeType) {
  els.previewArea.hidden = false;
  els.previewContent.innerHTML = '';

  const [major] = mimeType.split('/');
  let node = null;

  if (major === 'image') {
    node = document.createElement('img');
    node.src = url;
    node.alt = 'decoded preview image';
  } else if (major === 'audio') {
    node = document.createElement('audio');
    node.controls = true;
    node.src = url;
  } else if (major === 'video') {
    node = document.createElement('video');
    node.controls = true;
    node.src = url;
  } else if (mimeType === 'application/pdf') {
    node = document.createElement('iframe');
    node.src = url;
    node.title = 'decoded pdf preview';
    node.style.height = '420px';
  } else if (mimeType.startsWith('text/')) {
    node = document.createElement('iframe');
    node.src = url;
    node.title = 'decoded text preview';
    node.style.height = '320px';
  }

  if (node) {
    els.previewContent.appendChild(node);
    setStatus(`미리보기/재생 준비 완료 (${mimeType}).`);
    return;
  }

  const info = document.createElement('pre');
  info.textContent = `이 MIME 타입(${mimeType})은 브라우저 미리보기를 지원하지 않을 수 있습니다.\nBinary 다운로드 버튼을 사용하세요.`;
  els.previewContent.appendChild(info);
  setStatus(`미리보기를 지원하지 않는 MIME 타입입니다. 다운로드를 이용하세요.`);
}

init();
