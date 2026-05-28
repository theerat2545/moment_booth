import { useEffect, useRef, useState } from "react";
import { Camera, Download, RotateCcw } from "lucide-react";
import "./style.css";

const PHOTO_COUNTS = [1, 2, 3, 4];
const LAYOUTS = [
  { id: "1x1", label: "1x1", count: 1, cols: 1, rows: 1 },
  { id: "1x2", label: "1x2", count: 2, cols: 1, rows: 2 },
  { id: "2x1", label: "2x1", count: 2, cols: 2, rows: 1 },
  { id: "1x3", label: "1x3", count: 3, cols: 1, rows: 3 },
  { id: "3x1", label: "3x1", count: 3, cols: 3, rows: 1 },
  { id: "2x2", label: "2x2", count: 4, cols: 2, rows: 2 },
  { id: "1x4", label: "1x4", count: 4, cols: 1, rows: 4 },
  { id: "4x1", label: "4x1", count: 4, cols: 4, rows: 1 },
];
const FILTERS = [
  { id: "clean", label: "Clean", css: "none", canvas: "none" },
  {
    id: "soft",
    label: "Soft",
    css: "contrast(0.95) saturate(0.9) brightness(1.06)",
    canvas: "contrast(0.95) saturate(0.9) brightness(1.06)",
  },
  {
    id: "mono",
    label: "Mono",
    css: "grayscale(1) contrast(1.05)",
    canvas: "grayscale(1) contrast(1.05)",
  },
  {
    id: "warm",
    label: "Warm",
    css: "sepia(0.18) saturate(1.08) brightness(1.02)",
    canvas: "sepia(0.18) saturate(1.08) brightness(1.02)",
  },
];

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [isShooting, setIsShooting] = useState(false);
  const [caption, setCaption] = useState("tiny moments, forever kept.");
  const [theme, setTheme] = useState("cream");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [showDate, setShowDate] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [shotCount, setShotCount] = useState(4);
  const [selectedLayout, setSelectedLayout] = useState(LAYOUTS.find((layout) => layout.id === "2x2"));

  const layoutOptions = LAYOUTS.filter((layout) => layout.count === shotCount);
  const progressText = `${photos.length}/${shotCount}`;
  const dateStamp = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    startCamera();
    return () => stopCamera(false);
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, cameraError]);

  async function startCamera() {
    try {
      setCameraError("");

      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = media;
      setStream(media);

      if (videoRef.current) {
        videoRef.current.srcObject = media;
      }
    } catch {
      setCameraError("Camera access is needed to start the booth.");
    }
  }

  function stopCamera(shouldUpdateState = true) {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (shouldUpdateState) {
      setStream(null);
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.filter = filter.canvas;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";

    return canvas.toDataURL("image/png");
  }

  async function startPhotobooth() {
    if (isShooting || cameraError || !stream) return;

    setPhotos([]);
    setIsShooting(true);

    const result = [];

    for (let i = 0; i < shotCount; i++) {
      for (let n = 3; n > 0; n--) {
        setCountdown(n);
        await wait(700);
      }

      setCountdown("SNAP");
      result.push(captureFrame());
      setPhotos([...result]);

      await wait(500);
    }

    setCountdown(null);
    setIsShooting(false);
  }

  function selectShotCount(count) {
    setShotCount(count);
    setSelectedLayout(LAYOUTS.find((layout) => layout.count === count));
    reset();
  }

  function reset() {
    setPhotos([]);
    setCountdown(null);
    setIsShooting(false);
  }

  function downloadStrip() {
    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d");

    const frameW = 760;
    const frameH = 570;
    const padding = 70;
    const gap = 28;
    const footer = 180;
    const width = padding * 2 + selectedLayout.cols * frameW + (selectedLayout.cols - 1) * gap;
    const gridHeight = selectedLayout.rows * frameH + (selectedLayout.rows - 1) * gap;

    exportCanvas.width = width;
    exportCanvas.height = padding * 2 + gridHeight + footer;

    ctx.fillStyle = theme === "cream" ? "#f7efe3" : "#111118";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    const loadImages = photos.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        })
    );

    Promise.all(loadImages).then((images) => {
      images.forEach((img, index) => {
        const col = index % selectedLayout.cols;
        const row = Math.floor(index / selectedLayout.cols);
        const x = padding + col * (frameW + gap);
        const y = padding + row * (frameH + gap);

        ctx.fillStyle = "#000";
        ctx.fillRect(x, y, frameW, frameH);

        const ratio = Math.max(frameW / img.width, frameH / img.height);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        const dx = x + (frameW - drawW) / 2;
        const dy = y + (frameH - drawH) / 2;

        ctx.drawImage(img, dx, dy, drawW, drawH);
      });

      ctx.fillStyle = theme === "cream" ? "#171717" : "#f8f8f8";
      ctx.textAlign = "center";
      ctx.font = "600 42px Inter, Arial, sans-serif";
      ctx.fillText("Moment Booth", width / 2, exportCanvas.height - 105);

      ctx.font = "26px Inter, Arial, sans-serif";
      ctx.fillText(caption, width / 2, exportCanvas.height - 58);

      if (showDate) {
        ctx.font = "20px Inter, Arial, sans-serif";
        ctx.fillText(dateStamp, width / 2, exportCanvas.height - 24);
      }

      const link = document.createElement("a");
      link.download = "moment-booth.png";
      link.href = exportCanvas.toDataURL("image/png");
      link.click();
    });
  }

  return (
    <main className={`app theme-${theme}`}>
      <section className="hero">
        <p className="eyebrow">MOMENT BOOTH</p>
        <h1>Four-frame photo strip</h1>
      </section>

      <section className="workspace">
        <div className="camera-card">
          <div className="camera-toolbar">
            <span>{progressText} frames</span>
            <span>{selectedLayout.label} / {filter.label}</span>
          </div>

          <div className="camera-preview">
            {cameraError ? (
              <div className="camera-empty">
                <span>{cameraError}</span>
                <button className="secondary" onClick={startCamera} type="button">
                  <Camera size={16} />
                  Try again
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ filter: filter.css }}
              />
            )}

            {countdown && <div className="countdown">{countdown}</div>}
          </div>

          <button className="shoot" onClick={startPhotobooth} disabled={isShooting}>
            <Camera size={18} />
            {isShooting ? "Shooting..." : "Start booth"}
          </button>
        </div>

        <div className="strip-card">
          <div
            className="strip"
            style={{
              "--strip-cols": selectedLayout.cols,
              "--strip-rows": selectedLayout.rows,
            }}
          >
            <div className="strip-grid">
              {Array.from({ length: shotCount }).map((_, index) =>
                photos[index] ? (
                  <img key={index} src={photos[index]} alt={`Frame ${index + 1}`} />
                ) : (
                  <div className="frame-slot" key={index}>
                    {index + 1}
                  </div>
                )
              )}
            </div>

            <div className="strip-footer">
              <strong>Moment Booth</strong>
              <span>{caption}</span>
              {showDate && <em>{dateStamp}</em>}
            </div>
          </div>

          <div className="controls">
            <div className="option-group">
              <span className="control-label">Photos</span>
              <div className="count-grid">
                {PHOTO_COUNTS.map((count) => (
                  <button
                    className={shotCount === count ? "option active" : "option"}
                    key={count}
                    onClick={() => selectShotCount(count)}
                    type="button"
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="option-group">
              <span className="control-label">Frame</span>
              <div className="layout-grid">
                {layoutOptions.map((layout) => (
                  <button
                    className={selectedLayout.id === layout.id ? "option active" : "option"}
                    key={layout.id}
                    onClick={() => {
                      setSelectedLayout(layout);
                      reset();
                    }}
                    type="button"
                  >
                    {layout.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-grid" aria-label="Filter presets">
              {FILTERS.map((preset) => (
                <button
                  className={filter.id === preset.id ? "filter active" : "filter"}
                  key={preset.id}
                  onClick={() => setFilter(preset)}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <input
              aria-label="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />

            <label className="toggle">
              <input
                checked={showDate}
                onChange={(e) => setShowDate(e.target.checked)}
                type="checkbox"
              />
              <span>Date stamp</span>
            </label>

            <div className="control-row">
              <select
                aria-label="Theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="cream">Light</option>
                <option value="dark">Dark</option>
              </select>

              <button onClick={downloadStrip} disabled={photos.length !== shotCount}>
                <Download size={16} />
                Download
              </button>

              <button className="secondary" onClick={reset}>
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      <canvas ref={canvasRef} hidden />
    </main>
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
