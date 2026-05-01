// 화면 캡처 — Tauri WebView2 / Chromium 의 getDisplayMedia 사용.
// 사용자가 OS 다이얼로그에서 어떤 화면/창을 공유할지 직접 선택.
// 별도 Rust 의존성 0, 권한 1회만 묻고 그 후 자동.

export type CaptureMode = "screen" | "window" | "region";

export type CaptureResult = {
  /** PNG dataURL */
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
};

/** 사용자 동의 다이얼로그 띄우고 한 프레임 캡처. 사용 후 트랙 정리. */
export async function captureOnce(_mode: CaptureMode = "screen"): Promise<CaptureResult> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("이 환경에서는 화면 캡처를 지원하지 않아요.");
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: _mode === "window" ? "window" : "monitor" } as MediaTrackConstraints,
    audio: false,
  });

  try {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("비디오 트랙이 없어요.");

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // 첫 프레임 대기 (안정적인 캡처).
    await new Promise<void>((r) => {
      if (video.videoWidth > 0) return r();
      video.onloadedmetadata = () => r();
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스 컨텍스트를 만들지 못했어요.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    for (const t of stream.getTracks()) t.stop();
  }
}

/** dataURL 의 대략적인 KB 크기 — 미리보기에 표기용. */
export function approxSizeKb(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round((base64.length * 0.75) / 1024);
}
