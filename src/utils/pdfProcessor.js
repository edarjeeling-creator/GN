import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import Tesseract from 'tesseract.js';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Setup pdf.js worker - from the main thread this works perfectly!
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const extractTextData = (text) => {
  const result = {
    uid: null,
    name: null,
    className: null,
    sec: null,
    rollNo: null
  };

  const uidMatch = text.match(/UID[\.\:\s]*(\d+)/i);
  if (uidMatch) result.uid = uidMatch[1];

  const nameMatch = text.match(/NAME[\.\:\s]*([A-Z\.\s]+)/i);
  if (nameMatch) {
    let nameStr = nameMatch[1].replace(/FATHER.*/i, '').replace(/DATE.*/i, '').replace(/CLASS.*/i, '').trim();
    result.name = nameStr;
  }

  const classMatch = text.match(/CLASS[\.\:\s]*([IVX]+|\d+)[\s]*SEC[\.\:\s]*['"]?([A-Z])['"]?/i);
  if (classMatch) {
    result.className = classMatch[1];
    result.sec = classMatch[2];
  } else {
    const justClassMatch = text.match(/CLASS[\.\:\s]*([IVX]+|\d+)/i);
    if (justClassMatch) result.className = justClassMatch[1];
  }

  return result;
};

const processPage = async (page) => {
  const textContent = await page.getTextContent();
  let text = textContent.items.map(item => item.str).join(' ');
  
  let extractedData = extractTextData(text);
  let photoBlob = null;
  const ops = await page.getOperatorList();
  
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
      const imgName = ops.argsArray[i][0];
      try {
        const img = await page.objs.get(imgName);
        if (img && img.width > 50 && img.height > 50) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          const imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
          ctx.putImageData(imageData, 0, 0);
          photoBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          break; 
        }
      } catch (e) {
        console.warn("Failed to extract image object", e);
      }
    }
  }

  if (!extractedData.uid && !extractedData.name) {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    
    const pageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    
    const { data: { text: ocrText } } = await Tesseract.recognize(pageBlob, 'eng');
    extractedData = extractTextData(ocrText);
    
    if (!photoBlob) {
      const photoCanvas = document.createElement('canvas');
      photoCanvas.width = viewport.width * 0.35;
      photoCanvas.height = viewport.height * 0.6;
      const photoCtx = photoCanvas.getContext('2d');
      photoCtx.drawImage(canvas, 
        viewport.width * 0.05, viewport.height * 0.25, viewport.width * 0.35, viewport.height * 0.6,
        0, 0, photoCanvas.width, photoCanvas.height
      );
      photoBlob = await new Promise(resolve => photoCanvas.toBlob(resolve, 'image/jpeg', 0.9));
    }
  }

  return { photoBlob, ...extractedData };
};

export const processPdfFile = async (fileBuffer, onProgress) => {
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
      
      if (onProgress) {
        onProgress(Math.round((pageNum / pdf.numPages) * 100));
      }
    } catch (pageErr) {
      console.error(`Error processing page ${pageNum}`, pageErr);
    }
  }
  
  return results;
};
