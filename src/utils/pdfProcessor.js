import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import Tesseract from 'tesseract.js';
// Setup pdf.js worker - load from unpkg CDN to avoid heavy bundling (which crashes small servers)
// and to avoid local .mjs module fetch issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
          const originalCanvas = document.createElement('canvas');
          originalCanvas.width = img.width;
          originalCanvas.height = img.height;
          const ctx = originalCanvas.getContext('2d');
          const imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
          ctx.putImageData(imageData, 0, 0);

          // Crop the image perfectly around the photo area based on the actual ID card layout
          const cropX = img.width * 0.11; 
          const cropY = img.height * 0.36;
          const cropW = img.width * 0.26;
          const cropH = img.height * 0.41;

          const canvas = document.createElement('canvas');
          canvas.width = cropW;
          canvas.height = cropH;
          const cropCtx = canvas.getContext('2d');
          cropCtx.drawImage(originalCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          photoBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          break; 
        }
      } catch (e) {
        console.warn("Failed to extract image object", e);
      }
    }
  }

  if (!photoBlob) {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    
    const photoCanvas = document.createElement('canvas');
    // Perfect crop coordinates to isolate the face on the left side of the ID card
    const cropX = viewport.width * 0.11;
    const cropY = viewport.height * 0.36;
    const cropW = viewport.width * 0.26;
    const cropH = viewport.height * 0.41;
    
    photoCanvas.width = cropW;
    photoCanvas.height = cropH;
    const photoCtx = photoCanvas.getContext('2d');
    photoCtx.drawImage(canvas, 
      cropX, cropY, cropW, cropH,
      0, 0, cropW, cropH
    );
    photoBlob = await new Promise(resolve => photoCanvas.toBlob(resolve, 'image/jpeg', 0.9));

    if (!extractedData.uid && !extractedData.name) {
      const pageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const { data: { text: ocrText } } = await Tesseract.recognize(pageBlob, 'eng');
      extractedData = extractTextData(ocrText);
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
