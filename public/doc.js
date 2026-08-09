

















const video = document.getElementById('webcam');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('capture-btn');
const saveBtn = document.getElementById('save-btn');

let animationFrameId = null;
let capturedBlob = null;
let isPreviewing = false;

// 1. Request access specifically to the FRONT camera
navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: "user", // Forces front camera
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: false
})
.then((stream) => {
  video.srcObject = stream;
  video.play();
})
.catch((err) => {
  console.error("Camera access error:", err);
  alert("Unable to access front camera. Please check permissions.");
});

// Automatically adjust canvas internal dimensions once video metadata arrives
video.addEventListener('loadedmetadata', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  captureBtn.disabled = false;
  startLiveFeed();
});

// 2. Continuously render video frames onto canvas
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

// 3. Handle 'Take Photo' / 'Retake' click
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

// 4. Send photo and document name to backend
saveBtn.addEventListener('click', async () => {
  if (!capturedBlob) return;

  const docName = prompt("Enter a name for this document:", "MyDocument");
  if (!docName) return;

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
      alert("Extracted Text:\n\n" + (result.extracted_text || "No text detected."));
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