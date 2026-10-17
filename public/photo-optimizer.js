/* SODARAMU photo optimizer v1.0.0
   Compresses selected image files before existing change/submit handlers run.
   Non-image files and the current upload API/form field names are left untouched. */
(() => {
  "use strict";
  const MAX_EDGE = 800;
  const MAX_BYTES = 300 * 1024;
  const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const EDGE_STEPS = [800, 720, 640, 560, 480, 400, 320];
  const QUALITY_STEPS = [0.70, 0.58, 0.46, 0.38];
  const generationByInput = new WeakMap();
  const statusByInput = new WeakMap();

  const isImageFile = (file) => file instanceof File &&
    (MIME_TYPES.has(file.type.toLowerCase()) || file.type.toLowerCase().startsWith("image/"));

  function getStatus(input) {
    let status = statusByInput.get(input);
    if (status && status.isConnected) return status;
    const container = input.closest(".photo-box,.profile-upload,.field,.dashfield,.upload-control,.respondent-photo-upload") || input.parentElement;
    if (!container) return null;
    status = container.querySelector(":scope > .photo-optimizer-status");
    if (!status) {
      status = document.createElement("small");
      status.className = "photo-optimizer-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      container.appendChild(status);
    }
    statusByInput.set(input, status);
    return status;
  }

  function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file).then(bitmap => ({
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close?.()
      })).catch(() => decodeImageWithElement(file));
    }
    return decodeImageWithElement(file);
  }

  function decodeImageWithElement(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Dimensi foto tidak valid."));
          return;
        }
        resolve({
          source: image,
          width: image.naturalWidth,
          height: image.naturalHeight,
          close: () => URL.revokeObjectURL(objectUrl)
        });
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Foto tidak dapat dibaca oleh browser."));
      };
      image.src = objectUrl;
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Kompresi foto gagal.")), mimeType, quality);
        return;
      }
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const comma = dataUrl.indexOf(",");
        const header = dataUrl.slice(0, comma);
        const actualType = (header.match(/^data:([^;]+)/) || [])[1] || mimeType;
        const binary = atob(dataUrl.slice(comma + 1));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        resolve(new Blob([bytes], { type: actualType }));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Browser tidak mendukung kompresi foto."));
      }
    });
  }

  function makeCanvas(source, sourceWidth, sourceHeight, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight), MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas foto tidak tersedia.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    return canvas;
  }

  function outputName(originalName, mimeType) {
    const stem = String(originalName || "foto").replace(/\.[^.]+$/, "") || "foto";
    return stem + (mimeType === "image/webp" ? ".webp" : ".jpg");
  }

  async function compressImage(file, options = {}) {
    if (!isImageFile(file)) return file;
    if (!file.size) throw new Error("File foto kosong.");
    const maxBytes = Math.min(MAX_BYTES, Number(options.maxBytes) || MAX_BYTES);
    const { source, width, height, close } = await decodeImage(file);
    try {
      const initialEdge = Math.min(MAX_EDGE, Math.max(width, height));
      const initialCanvas = makeCanvas(source, width, height, initialEdge);
      const webpProbe = await canvasToBlob(initialCanvas, "image/webp", 0.70);
      const mimeType = webpProbe.type === "image/webp" ? "image/webp" : "image/jpeg";
      let bestBlob = null;

      const edges = [...new Set([initialEdge, ...EDGE_STEPS.filter(edge => edge < initialEdge)])];
      for (const edge of edges) {
        const canvas = edge === initialEdge ? initialCanvas : makeCanvas(source, width, height, edge);
        for (const quality of QUALITY_STEPS) {
          let blob;
          if (edge === initialEdge && quality === 0.70 && webpProbe.type === mimeType) {
            blob = webpProbe;
          } else {
            blob = await canvasToBlob(canvas, mimeType, quality);
          }
          if (blob.type !== mimeType) continue;
          if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
          if (blob.size > 0 && blob.size <= maxBytes) {
            return new File([blob], outputName(file.name, mimeType), {
              type: mimeType,
              lastModified: file.lastModified || Date.now()
            });
          }
        }
        if (canvas !== initialCanvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
      if (bestBlob && bestBlob.size <= maxBytes) {
        return new File([bestBlob], outputName(file.name, mimeType), {
          type: mimeType,
          lastModified: file.lastModified || Date.now()
        });
      }
      throw new Error("Foto belum bisa dikompresi hingga di bawah 300 KB. Pilih foto yang lebih kecil atau potong bagian yang tidak diperlukan.");
    } finally {
      close();
    }
  }

  async function optimizeInput(input, generation) {
    const status = getStatus(input);
    const originalFiles = Array.from(input.files || []);
    if (status) {
      status.dataset.state = "loading";
      status.textContent = "Mengoptimalkan foto…";
    }
    input.dataset.photoOptimizerBusy = "1";
    try {
      const outputFiles = [];
      for (const file of originalFiles) {
        outputFiles.push(isImageFile(file) ? await compressImage(file) : file);
        if (generationByInput.get(input) !== generation) return;
      }
      if (generationByInput.get(input) !== generation) return;
      const transfer = new DataTransfer();
      outputFiles.forEach(file => transfer.items.add(file));
      input.files = transfer.files;

      const optimizedImages = outputFiles.filter(isImageFile);
      const totalBytes = optimizedImages.reduce((sum, file) => sum + file.size, 0);
      if (status) {
        status.dataset.state = "success";
        status.textContent = optimizedImages.length
          ? "Foto dioptimalkan: " + (totalBytes / 1024).toFixed(0) + " KB" + (optimizedImages.every(file => file.type === "image/webp") ? " (WebP)." : " (JPEG/WebP).")
          : "";
      }
      delete input.dataset.photoOptimizerBusy;
      input.dataset.photoOptimizerPassThrough = "1";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      if (generationByInput.get(input) !== generation) return;
      input.value = "";
      delete input.dataset.photoOptimizerBusy;
      if (status) {
        status.dataset.state = "error";
        status.textContent = error instanceof Error ? error.message : "Foto gagal dioptimalkan. Silakan pilih ulang.";
      }
      input.dataset.photoOptimizerPassThrough = "1";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  document.addEventListener("change", event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    if (input.dataset.photoOptimizerPassThrough === "1") {
      delete input.dataset.photoOptimizerPassThrough;
      return;
    }
    const files = Array.from(input.files || []);
    if (!files.some(isImageFile)) return;

    /* Run before existing page handlers, then replay change with the optimized files. */
    event.stopImmediatePropagation();
    const generation = (generationByInput.get(input) || 0) + 1;
    generationByInput.set(input, generation);
    void optimizeInput(input, generation);
  }, true);

  document.addEventListener("submit", event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const busy = Array.from(form.querySelectorAll('input[type="file"]')).find(input => input.dataset.photoOptimizerBusy === "1");
    if (!busy) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = getStatus(busy);
    if (status) status.textContent = "Tunggu kompresi foto selesai, lalu tekan tombol kirim kembali.";
  }, true);

  window.SODARAMUPhotoOptimizer = Object.freeze({
    compressImage,
    maxEdge: MAX_EDGE,
    maxBytes: MAX_BYTES
  });
})();
