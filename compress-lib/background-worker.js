function loadScript() {
  import("./gs-worker.js");
}

var Module;

function _GSPS2PDF(
  dataStruct,
  responseCallback,
) {
  // first download the ps data
  var xhr = new XMLHttpRequest();
  xhr.open("GET", dataStruct.psDataURL);
  xhr.responseType = "arraybuffer";
  xhr.onload = function () {
    console.log('onload')
    // release the URL
    self.URL.revokeObjectURL(dataStruct.psDataURL);
    
    // Store the original file size
    const originalSize = xhr.response.byteLength;
    
    // Determine compression settings based on target size
    let pdfSettings = "/screen"; // Default setting
    let imageResolution = 72;    // Default resolution
    
    // Get the target size in MB (if provided)
    const targetSizeMB = dataStruct.targetSizeMB || 5;
    
    // Adjust settings based on target size
    if (targetSizeMB <= 0.5) {
      // For very small files (under 512KB)
      pdfSettings = "/screen";
      imageResolution = 50; // Lower resolution for smaller files
    } else if (targetSizeMB <= 1) {
      // For files under 1MB
      pdfSettings = "/screen";
      imageResolution = 72;
    } else if (targetSizeMB <= 2) {
      // For files under 2MB
      pdfSettings = "/ebook";
      imageResolution = 150;
    } else {
      // For larger files (5MB+)
      pdfSettings = "/printer";
      imageResolution = 300;
    }
    
    //set up EMScripten environment
    Module = {
      preRun: [
        function () {
          self.Module.FS.writeFile("input.pdf", new Uint8Array(xhr.response));
        },
      ],
      postRun: [
        function () {
          var uarray = self.Module.FS.readFile("output.pdf", { encoding: "binary" });
          var blob = new Blob([uarray], { type: "application/octet-stream" });
          var pdfDataURL = self.URL.createObjectURL(blob);
          
          // Calculate compression stats
          const newSize = uarray.length;
          const compressionRatio = originalSize > 0 ? ((originalSize - newSize) / originalSize * 100).toFixed(2) : 0;
          
          // Return both the PDF URL and the compression stats
          responseCallback({ 
            pdfDataURL: pdfDataURL, 
            url: dataStruct.url,
            originalSize: originalSize,
            newSize: newSize,
            compressionRatio: compressionRatio,
            shouldClearPreview: true // Signal to clear the preview
          });
        },
      ],
      arguments: [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        `-dPDFSETTINGS=${pdfSettings}`,  // Dynamic setting based on target size
        "-DNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dColorImageDownsampleType=/Bicubic",  // Better image compression
        `-dColorImageResolution=${imageResolution}`,  // Dynamic resolution
        "-dGrayImageDownsampleType=/Bicubic",   
        `-dGrayImageResolution=${imageResolution}`,  // Dynamic resolution
        "-dMonoImageDownsampleType=/Bicubic",   
        `-dMonoImageResolution=${imageResolution}`,  // Dynamic resolution
        "-dEmbedAllFonts=false",                // Don't embed fonts to reduce size
        "-dSubsetFonts=true",                   // Only include used characters from fonts
        "-dCompressFonts=true",                 // Compress font data
        "-dDetectDuplicateImages=true",         // Detect and remove duplicate images
        "-sOutputFile=output.pdf",
        "input.pdf",
      ],
      print: function (text) {},
      printErr: function (text) {},
      totalDependencies: 0,
      noExitRuntime: 1
    };
    // Module.setStatus("Loading Ghostscript...");
    if (!self.Module) {
      self.Module = Module;
      loadScript();
    } else {
      self.Module["calledRun"] = false;
      self.Module["postRun"] = Module.postRun;
      self.Module["preRun"] = Module.preRun;
      self.Module.callMain();
    }
  };
  xhr.send();
}


self.addEventListener('message', function({data:e}) {
  console.log("message", e)
  // e.data contains the message sent to the worker.
  if (e.target !== 'wasm'){
    return;
  }
  console.log('Message received from main script', e.data);
  _GSPS2PDF(e.data, (response) => self.postMessage(response))
});

console.log("Worker ready")
