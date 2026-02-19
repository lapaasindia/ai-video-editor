#!/usr/bin/env python3
"""
Transcribe audio/video using faster-whisper and output JSON compatible
with the Lapaas AI Editor canonical transcript format.

Usage:
  python3 transcribe_faster_whisper.py <input_path> [--model tiny] [--language en] [--output transcript.json]
"""

import sys
import json
import argparse
import os

def main():
    parser = argparse.ArgumentParser(description='Transcribe with faster-whisper')
    parser.add_argument('input', help='Path to audio/video file')
    parser.add_argument('--model', default='tiny', help='Whisper model size (tiny, base, small, medium, large-v3)')
    parser.add_argument('--language', default=None, help='Language code (e.g. en, hi). Auto-detect if not specified.')
    parser.add_argument('--output', default=None, help='Output JSON path. Prints to stdout if not specified.')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({"error": f"Input file not found: {args.input}"}), file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster_whisper not installed"}), file=sys.stderr)
        sys.exit(1)

    # Use CPU for compatibility; Apple Silicon users can use int8
    print(f"[faster-whisper] Loading model '{args.model}'...", file=sys.stderr)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    print(f"[faster-whisper] Transcribing '{args.input}'...", file=sys.stderr)
    segments_iter, info = model.transcribe(
        args.input,
        language=args.language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
    )

    segments = []
    all_words = []
    word_index = 0

    for idx, segment in enumerate(segments_iter):
        seg_words = []
        if segment.words:
            for w in segment.words:
                word_obj = {
                    "id": f"word-{idx}-{word_index}",
                    "text": w.word.strip(),
                    "normalized": w.word.strip().lower().replace("'", "").replace(",", "").replace(".", ""),
                    "startUs": int(w.start * 1_000_000),
                    "endUs": int(w.end * 1_000_000),
                    "confidence": round(w.probability, 3) if hasattr(w, 'probability') else 0.9,
                }
                seg_words.append(word_obj)
                all_words.append(word_obj)
                word_index += 1

        seg_obj = {
            "id": f"seg-{idx}",
            "startUs": int(segment.start * 1_000_000),
            "endUs": int(segment.end * 1_000_000),
            "text": segment.text.strip(),
            "words": seg_words,
            "confidence": round(segment.avg_log_prob, 3) if hasattr(segment, 'avg_log_prob') else 0.9,
        }
        segments.append(seg_obj)
        print(f"  [{segment.start:.1f}s - {segment.end:.1f}s] {segment.text.strip()}", file=sys.stderr)

    result = {
        "language": info.language if info.language else (args.language or "en"),
        "languageProbability": round(info.language_probability, 3) if hasattr(info, 'language_probability') else 1.0,
        "duration": info.duration if hasattr(info, 'duration') else 0,
        "segments": segments,
        "words": all_words,
        "wordCount": len(all_words),
    }

    output_json = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output_json)
        print(f"[faster-whisper] Wrote transcript to {args.output}", file=sys.stderr)
    else:
        print(output_json)

    print(f"[faster-whisper] Done. {len(segments)} segments, {len(all_words)} words.", file=sys.stderr)

if __name__ == '__main__':
    main()
