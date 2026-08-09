const video = document.getElementById('webcam');
const canvas = document.getElementById('camera-canvas');
const ctx = canvas.getContext('2d');
const captureBtn = document.getElementById('capture-btn');
const saveBtn = document.getElementById('save-btn');

let animationFrameId = null;
let capturedBlob = null;
let isPreviewing = false;






// 1. Request access to camera stream
navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  .then((stream) => {
    video.srcObject = stream;
    video.play();
    captureBtn.disabled = false;
    startLiveFeed();
  })
  .catch((err) => {
    console.error("Camera access error:", err);
    alert("Unable to access camera. Please allow permissions.");
  });

// 2. Continuously draw live video stream onto canvas
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
    // Freezes current frame on canvas
    stopLiveFeed();
    
    // Draw current frame one last time to fix image in canvas context
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert frozen canvas to Image Blob
    canvas.toBlob((blob) => {
      capturedBlob = blob;
      isPreviewing = true;
      captureBtn.innerText = "Retake / Back";
      saveBtn.classList.remove('hidden');
    }, 'image/jpeg', 0.95);

  } else {
    // If already in preview mode, clicking acts as "Back" to restart camera feed
    capturedBlob = null;
    startLiveFeed();
  }
});

// 4. Handle 'Save' button click to send photo to backend
saveBtn.addEventListener('click', async () => {
  if (!capturedBlob) return;

  const formData = new FormData();
  formData.append('photo', capturedBlob, 'document.jpg');

  try {
    saveBtn.disabled = true;
    captureBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      alert("Document saved and uploaded successfully!");
      // Reset back to live stream
      startLiveFeed();
    } else {
      alert("Failed to save document on server.");
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