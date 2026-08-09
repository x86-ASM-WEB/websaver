



















const video = document.getElementById('webcam');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('capture-btn');
const saveBtn = document.getElementById('save-btn');

let animationFrameId = null;
let capturedBlob = null;
let isPreviewing = false;

// 1. Request access specifically to the REAR / DOCUMENT camera
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { exact: "environment" } // Forces back camera (document camera)
  },
  audio: false
})
.catch(() => {
  // Fallback if 'exact' is not strictly supported by the browser
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false
  });
})
.then((stream) => {
  video.srcObject = stream;
  video.play();
})
.catch((err) => {
  console.error("Camera access error:", err);
  alert("Unable to access the back camera. Please ensure camera permissions are allowed.");
});

// Automatically adjust canvas dimensions to match actual camera output ratio
video.addEventListener('loadedmetadata', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  captureBtn.disabled = false;
  startLiveFeed();
});

// 2. Continuous drawing loop
function drawFrame() {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  animationFrameId = requestAnimationFrame(drawFrame);
}

function startLiveFeed() {
  isPreviewing = false;
  captureBtn.innerText = "Take Photo";
  saveBtn.classList.add('hidden');
  drawFrame();
}

function stopLiveFeed() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

// 3. Take Photo / Retake Logic
captureBtn.addEventListener('click', () => {
  if (!isPreviewing) {
    stopLiveFeed();
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      capturedBlob = blob;
      isPreviewing = true;
      captureBtn.innerText = "Retake / Back";
      saveBtn.classList.remove('hidden');
    }, 'image/jpeg', 0.95);

  } else {
    capturedBlob = null;
    startLiveFeed();
  }
});

// 4. Ask for document name and upload to backend
saveBtn.addEventListener('click', async () => {
  if (!capturedBlob) return;

  // Prompt the user for a document name
  const docName = prompt("Enter a name for this document:", "My_Document");
  
  // Exit if user cancels or enters an empty name
  if (!docName || docName.trim() === "") {
    alert("Document name is required to save.");
    return;
  }

  // Clean filename (remove special characters and spaces)
  const cleanName = docName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");

  const formData = new FormData();
  formData.append('photo', capturedBlob, `${cleanName}.jpg`);
  formData.append('doc_name', cleanName);

  try {
    saveBtn.disabled = true;
    captureBtn.disabled = true;
    saveBtn.innerText = "Processing...";

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`Saved as: ${result.filename || cleanName + '.txt'}\n\nExtracted Text:\n\n` + (result.extracted_text || "No text detected."));
      startLiveFeed();
    } else {
      alert("Error: " + (result.error || "Failed to process photo."));
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert("Network error: Could not reach server.");
  } finally {
    saveBtn.disabled = false;
    captureBtn.disabled = false;
    saveBtn.innerText = "Save & Send";
  }
});