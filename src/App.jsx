import { useEffect, useRef, useState } from "react";
import { Camera, Download, RotateCcw, Trash2 } from "lucide-react";
import { FILTERS } from "./filters";
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
const STICKER_PRESETS = [
  { label: "Spark", value: "\u2728" },
  { label: "Heart", value: "\u2764\uFE0F" },
  { label: "Star", value: "\u2B50" },
  { label: "Smile", value: "\u{1F60A}" },
  { label: "Cool", value: "\u{1F60E}" },
  { label: "Bloom", value: "\u{1F338}" },
  { label: "Bow", value: "\u{1F380}" },
  { label: "MOMENT", value: "MOMENT" },
];

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
  const [selectedFilter, setSelectedFilter] = useState(FILTERS[0]);
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
    await waitForFontReady();

    const stickerSnapshot = stickers.map((sticker) => ({ ...sticker }));
    const source = captureRawSourceFrame(videoRef.current, canvasRef.current);
    const src = captureFilteredVideoFrame(
      videoRef.current,
      canvasRef.current,
      stickerSnapshot,
      selectedFilter
    );

    return {
      source,
      src,
      stickers: stickerSnapshot,
      filterId: selectedFilter.id,
    };
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

  async function selectFilter(nextFilter) {
    setSelectedFilter(nextFilter);

    if (photos.length === 0) return;

    const nextPhotos = await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        src: await renderFilteredPhoto(photo.source, nextFilter, photo.stickers ?? []),
        filterId: nextFilter.id,
      }))
    );

    setPhotos(nextPhotos);
  }

  function addSticker(value) {
    const offset = stickers.length * 4;
    const id = crypto.randomUUID();

    setStickers([
      ...stickers,
      {
        id,
        value,
        x: Math.min(72, 42 + offset),
        y: Math.min(72, 38 + offset),
        size: value.length > 5 ? 9 : 11,
        rotation: 0,
      },
    ]);
    setActiveStickerId(id);
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
    event.preventDefault();
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
    event.preventDefault();

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
      (photo) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = photo.src;
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
        addVignette(ctx, x, y, frameW, frameH, selectedFilter.vignette * 0.35);
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
            <span>{selectedLayout.label} / {selectedFilter.name}</span>
          </div>

          <div
            className="camera-preview"
            style={{
              "--filter-overlay": selectedFilter.overlayColor,
              "--filter-grain": selectedFilter.grain,
              "--filter-vignette": selectedFilter.vignette,
            }}
          >
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
                style={{ filter: selectedFilter.cssFilter }}
              />
            )}

            {!cameraError && (
              <>
                <div className="filter-preview-overlay" />
                <div className="filter-preview-vignette" />
                <div className="filter-preview-grain" />
                <div className="sticker-layer">
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
              </>
            )}

            {countdown && <div className="countdown">{countdown}</div>}
          </div>

          <button className="shoot" onClick={startPhotobooth} disabled={isShooting}>
            <Camera size={18} />
            {isShooting ? "Shooting..." : "Start booth"}
          </button>

          <div className="filter-carousel" aria-label="Filter presets">
            {FILTERS.map((preset) => (
              <button
                className={selectedFilter.id === preset.id ? "filter-card active" : "filter-card"}
                key={preset.id}
                onClick={() => selectFilter(preset)}
                type="button"
              >
                <span
                  className="filter-thumb"
                  style={{
                    filter: preset.cssFilter,
                    "--filter-overlay": preset.overlayColor,
                    "--filter-vignette": preset.vignette,
                  }}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
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
                  <img key={index} src={photos[index].src} alt={`Frame ${index + 1}`} />
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

            <div className="option-group">
              <span className="control-label">Stickers</span>
              <div className="sticker-grid">
                {STICKER_PRESETS.map((sticker) => (
                  <button
                    aria-label={`Add ${sticker.label} sticker`}
                    className="option emoji-option"
                    key={sticker.label}
                    onClick={() => addSticker(sticker.value)}
                    type="button"
                  >
                    {sticker.value}
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
              onChange={(event) => setCaption(event.target.value)}
            />

            <label className="toggle">
              <input
                checked={showDate}
                onChange={(event) => setShowDate(event.target.checked)}
                type="checkbox"
              />
              <span>Date stamp</span>
            </label>

            <div className="control-row">
              <select
                aria-label="Theme"
                value={theme}
                onChange={(event) => setTheme(event.target.value)}
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

function captureRawSourceFrame(video, canvas) {
  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas.toDataURL("image/png");
}

function captureFilteredVideoFrame(video, canvas, stickers, filter) {
  const ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  if (supportsCanvasFilter(ctx)) {
    ctx.filter = filter.cssFilter;
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  addFilterOverlay(ctx, canvas.width, canvas.height, filter.overlayColor);
  addVignette(ctx, 0, 0, canvas.width, canvas.height, filter.vignette);
  addGrain(ctx, canvas.width, canvas.height, filter.grain);
  drawStickers(ctx, canvas.width, canvas.height, stickers);

  return canvas.toDataURL("image/png");
}

async function renderFilteredPhoto(source, filter, stickers = []) {
  const img = await loadImage(source);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (supportsCanvasFilter(ctx)) {
    ctx.filter = filter.cssFilter;
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";

  addFilterOverlay(ctx, canvas.width, canvas.height, filter.overlayColor);
  addVignette(ctx, 0, 0, canvas.width, canvas.height, filter.vignette);
  addGrain(ctx, canvas.width, canvas.height, filter.grain);
  drawStickers(ctx, canvas.width, canvas.height, stickers);

  return canvas.toDataURL("image/png");
}

function waitForFontReady() {
  if (!document.fonts?.ready) {
    return Promise.resolve();
  }

  return document.fonts.ready.catch(() => undefined);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function supportsCanvasFilter(ctx) {
  return "filter" in ctx;
}

function addFilterOverlay(ctx, width, height, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function addVignette(ctx, x, y, width, height, amount = 0) {
  if (!amount) return;

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radius = Math.max(width, height) * 0.72;
  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);

  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${amount})`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function addGrain(ctx, width, height, amount = 0) {
  if (!amount) return;

  const density = Math.floor((width * height) / 260);

  ctx.save();
  for (let i = 0; i < density; i++) {
    const alpha = Math.random() * amount;
    const value = Math.random() > 0.5 ? 255 : 0;

    ctx.fillStyle = `rgba(${value}, ${value}, ${value}, ${alpha})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
  }
  ctx.restore();
}

function drawStickers(ctx, width, height, stickers) {
  stickers.forEach((sticker) => {
    const x = (sticker.x / 100) * width;
    const y = (sticker.y / 100) * height;
    const size = (sticker.size / 100) * width;
    const isEmoji = Array.from(sticker.value).some((char) => char.codePointAt(0) > 255);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${size}px Inter, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = Math.max(4, size * 0.06);

    if (!isEmoji) {
      ctx.strokeText(sticker.value, 0, 0);
    }

    ctx.fillText(sticker.value, 0, 0);
    ctx.restore();
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
