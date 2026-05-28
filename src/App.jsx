import { useEffect, useRef, useState } from "react";
import { Camera, Download, RotateCcw, Trash2 } from "lucide-react";
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
  { id: "clean", label: "Clean", preview: "none", apply: null },
  {
    id: "soft",
    label: "Soft",
    preview: "contrast(0.95) saturate(0.9) brightness(1.06)",
    apply(caman) {
      caman.brightness(6).contrast(-5).saturation(-10);
    },
  },
  {
    id: "mono",
    label: "Mono",
    preview: "grayscale(1) contrast(1.05)",
    apply(caman) {
      caman.greyscale().contrast(5);
    },
  },
  {
    id: "warm",
    label: "Warm",
    preview: "sepia(0.18) saturate(1.08) brightness(1.02)",
    apply(caman) {
      caman.sepia(18).saturation(8).brightness(2);
    },
  },
  {
    id: "vivid",
    label: "Vivid",
    preview: "contrast(1.12) saturate(1.22)",
    apply(caman) {
      caman.contrast(12).saturation(22);
    },
  },
];
const STICKER_PRESETS = ["✨", "♡", "★", "☻", "MOMENT"];
const CAMAN_SRC = "https://cdnjs.cloudflare.com/ajax/libs/camanjs/4.1.2/caman.full.min.js";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const dragRef = useRef(null);

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
  const [stickers, setStickers] = useState([]);
  const [activeStickerId, setActiveStickerId] = useState(null);

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

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    await applyCamanFilter(canvas, filter);
    drawStickers(ctx, canvas.width, canvas.height, stickers);

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
      result.push(await captureFrame());
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

  function addSticker(value) {
    const offset = stickers.length * 4;

    setStickers([
      ...stickers,
      {
        id: crypto.randomUUID(),
        value,
        x: Math.min(72, 42 + offset),
        y: Math.min(72, 38 + offset),
        size: value.length > 2 ? 10 : 11,
        rotation: 0,
      },
    ]);
  }

  function updateSticker(id, patch) {
    setStickers((current) =>
      current.map((sticker) => (sticker.id === id ? { ...sticker, ...patch } : sticker))
    );
  }

  function removeActiveSticker() {
    if (!activeStickerId) return;

    setStickers((current) => current.filter((sticker) => sticker.id !== activeStickerId));
    setActiveStickerId(null);
  }

  function startStickerDrag(event, sticker) {
    const bounds = event.currentTarget.parentElement.getBoundingClientRect();

    dragRef.current = {
      id: sticker.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: sticker.x,
      originY: sticker.y,
      width: bounds.width,
      height: bounds.height,
    };

    setActiveStickerId(sticker.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSticker(event) {
    if (!dragRef.current) return;

    const drag = dragRef.current;
    const nextX = drag.originX + ((event.clientX - drag.startX) / drag.width) * 100;
    const nextY = drag.originY + ((event.clientY - drag.startY) / drag.height) * 100;

    updateSticker(drag.id, {
      x: clamp(nextX, 5, 95),
      y: clamp(nextY, 5, 95),
    });
  }

  function stopStickerDrag() {
    dragRef.current = null;
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

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, frameW, frameH);
        ctx.clip();
        ctx.drawImage(img, dx, dy, drawW, drawH);
        ctx.restore();
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
                style={{ filter: filter.preview }}
              />
            )}

            {!cameraError && (
              <div className="sticker-layer" onPointerMove={moveSticker} onPointerUp={stopStickerDrag}>
                {stickers.map((sticker) => (
                  <button
                    className={activeStickerId === sticker.id ? "sticker active" : "sticker"}
                    key={sticker.id}
                    onPointerCancel={stopStickerDrag}
                    onPointerDown={(event) => startStickerDrag(event, sticker)}
                    onPointerMove={moveSticker}
                    onPointerUp={stopStickerDrag}
                    style={{
                      left: `${sticker.x}%`,
                      top: `${sticker.y}%`,
                      fontSize: `clamp(22px, ${sticker.size}vw, 82px)`,
                      transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
                    }}
                    type="button"
                  >
                    {sticker.value}
                  </button>
                ))}
              </div>
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

            <div className="option-group">
              <span className="control-label">Stickers</span>
              <div className="sticker-grid">
                {STICKER_PRESETS.map((sticker) => (
                  <button className="option" key={sticker} onClick={() => addSticker(sticker)} type="button">
                    {sticker}
                  </button>
                ))}
                <button
                  className="option"
                  disabled={!activeStickerId}
                  onClick={removeActiveSticker}
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {activeStickerId && (
              <div className="sticker-settings">
                <label>
                  <span>Size</span>
                  <input
                    max="18"
                    min="5"
                    onChange={(event) =>
                      updateSticker(activeStickerId, { size: Number(event.target.value) })
                    }
                    type="range"
                    value={stickers.find((sticker) => sticker.id === activeStickerId)?.size ?? 10}
                  />
                </label>

                <label>
                  <span>Rotate</span>
                  <input
                    max="35"
                    min="-35"
                    onChange={(event) =>
                      updateSticker(activeStickerId, { rotation: Number(event.target.value) })
                    }
                    type="range"
                    value={stickers.find((sticker) => sticker.id === activeStickerId)?.rotation ?? 0}
                  />
                </label>
              </div>
            )}

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

function applyCamanFilter(canvas, preset) {
  if (!preset.apply) {
    return Promise.resolve();
  }

  return loadCaman()
    .then(
      () =>
        new Promise((resolve) => {
          const source = document.createElement("canvas");
          const sourceCtx = source.getContext("2d");

          source.width = canvas.width;
          source.height = canvas.height;
          sourceCtx.drawImage(canvas, 0, 0);

          window.Caman(source, function applyPreset() {
            preset.apply(this);
            this.render(() => {
              const ctx = canvas.getContext("2d");
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(source, 0, 0);
              resolve();
            });
          });
        })
    )
    .catch(() => undefined);
}

function loadCaman() {
  if (window.Caman) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector(`script[src="${CAMAN_SRC}"]`);

  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CAMAN_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function drawStickers(ctx, width, height, stickers) {
  stickers.forEach((sticker) => {
    const x = (sticker.x / 100) * width;
    const y = (sticker.y / 100) * height;
    const size = (sticker.size / 100) * width;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = Math.max(4, size * 0.06);
    ctx.strokeText(sticker.value, 0, 0);
    ctx.fillText(sticker.value, 0, 0);
    ctx.restore();
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
