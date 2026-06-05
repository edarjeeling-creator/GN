import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import Tesseract from 'tesseract.js';

import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Setup worker - use the bundled worker URL provided by Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const extractTextData = (text) => {
  const result = {
    uid: null,
    name: null,
    className: null,
    sec: null,
    rollNo: null
  };

  // Extract UID
  const uidMatch = text.match(/UID[\.\:\s]*(\d+)/i);
  if (uidMatch) result.uid = uidMatch[1];

  // Extract Name (assuming format NAME: JOHN DOE or Name B.K. ELEANA)
  const nameMatch = text.match(/NAME[\.\:\s]*([A-Z\.\s]+)/i);
  if (nameMatch) {
    // Clean up name by stopping at common next lines like FATHER, CLASS, DOB
    let nameStr = nameMatch[1].replace(/FATHER.*/i, '').replace(/DATE.*/i, '').replace(/CLASS.*/i, '').trim();
    result.name = nameStr;
  }

  // Extract Class & Sec
  const classMatch = text.match(/CLASS[\.\:\s]*([IVX]+|\d+)[\s]*SEC[\.\:\s]*['"]?([A-Z])['"]?/i);
  if (classMatch) {
    result.className = classMatch[1];
    result.sec = classMatch[2];
  } else {
    // Just Class
    const justClassMatch = text.match(/CLASS[\.\:\s]*([IVX]+|\d+)/i);
    if (justClassMatch) result.className = justClassMatch[1];
  }

  return result;
};

const processPage = async (page) => {
  // 1. Try extracting text layer
  const textContent = await page.getTextContent();
  let text = textContent.items.map(item => item.str).join(' ');
  
  let extractedData = extractTextData(text);

  // 2. Extract image (Assuming 1 major photo per ID card)
  // We will render the page to an OffscreenCanvas and then crop the photo or just use the page as is if we can't extract the specific image object.
  // Actually, pdf.js can extract images via OperatorList, but rendering is more robust for ID cards to capture the photo.
  // Wait, if we render the whole page, we save the whole ID card instead of just the photo.
  // To extract just the photo, we look at the operator list.
  
  let photoBlob = null;
  const ops = await page.getOperatorList();
  
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
      const imgName = ops.argsArray[i][0];
      try {
        const img = await page.objs.get(imgName);
        if (img && img.width > 50 && img.height > 50) { // filter out logos/small icons
          const canvas = new OffscreenCanvas(img.width, img.height);
          const ctx = canvas.getContext('2d');
          const imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
          ctx.putImageData(imageData, 0, 0);
          photoBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
          break; // Found the first large image
        }
      } catch (e) {
        console.warn("Failed to extract image object", e);
      }
    }
  }

  // If we still don't have text (UID/NAME), fallback to OCR on the whole page
  if (!extractedData.uid && !extractedData.name) {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    
    // Create a canvas factory that works in worker
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    const pageBlob = await canvas.convertToBlob({ type: 'image/png' });
    
    // Run Tesseract
    const { data: { text: ocrText } } = await Tesseract.recognize(pageBlob, 'eng');
    extractedData = extractTextData(ocrText);
    
    // If we failed to extract a specific photo, we can just use the cropped left side of the ID card as a fallback
    if (!photoBlob) {
      const photoCanvas = new OffscreenCanvas(viewport.width * 0.35, viewport.height * 0.6);
      const photoCtx = photoCanvas.getContext('2d');
      photoCtx.drawImage(canvas, 
        viewport.width * 0.05, viewport.height * 0.25, viewport.width * 0.35, viewport.height * 0.6, // source
        0, 0, viewport.width * 0.35, viewport.height * 0.6 // dest
      );
      photoBlob = await photoCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    }
  }

  return { photoBlob, ...extractedData };
};

self.onmessage = async (e) => {
  const { fileBuffer } = e.data;
  
  try {
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdf = await loadingTask.promise;
    
    const results = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const result = await processPage(page);
        
        if (result.photoBlob) {
          results.push(result);
        }
        
        // Report progress
        self.postMessage({ type: 'progress', progress: Math.round((pageNum / pdf.numPages) * 100) });
      } catch (pageErr) {
        console.error(`Error processing page ${pageNum}`, pageErr);
      }
    }
    
    self.postMessage({ type: 'done', results });
    
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
};
