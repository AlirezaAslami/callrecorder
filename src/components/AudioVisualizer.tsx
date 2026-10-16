import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  barColor?: string;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  isRecording,
  barColor = '#f59e0b',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let bufferLength = 64;
    let dataArray = new Uint8Array(bufferLength);

    if (analyser) {
      analyser.fftSize = 128;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
    }

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isRecording) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Idle ambient gentle wave
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = isRecording ? 10 : Math.sin(Date.now() / 300 + i * 0.2) * 8 + 12;
        }
      }

      const barWidth = (width / bufferLength) * 1.6;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (height * 0.85);

        // Center vertically
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, barColor);
        gradient.addColorStop(1, '#ef4444');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, Math.max(2, barWidth - 2), Math.max(3, barHeight), 2);
        } else {
          ctx.rect(x, y, Math.max(2, barWidth - 2), Math.max(3, barHeight));
        }
        ctx.fill();

        x += barWidth;
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isRecording, barColor]);

  return (
    <canvas
      ref={canvasRef}
      width={480}
      height={80}
      className={`w-full h-20 rounded-lg bg-slate-900/60 border border-slate-800 ${className}`}
    />
  );
};
