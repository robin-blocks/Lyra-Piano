#!/bin/bash
# Generate speech clips for piano notes using macOS 'say' command
# Usage: ./scripts/generate-speech-clips.sh

OUTPUT_DIR="public/speech"
VOICE="Samantha"  # or try: Karen, Moira, Tessa, Fiona

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to generate a clip
generate_clip() {
    local filename="$1"
    local text="$2"
    local output_path="$OUTPUT_DIR/$filename"

    # Skip if already exists
    if [ -f "$output_path" ]; then
        echo "  Skipping $filename (exists)"
        return
    fi

    echo "  Generating $filename: \"$text\""

    # Generate AIFF then convert to 16kHz WAV
    local temp_aiff="/tmp/speech_temp.aiff"
    say -v "$VOICE" -o "$temp_aiff" "$text"

    # Convert to 16kHz 16-bit mono WAV
    ffmpeg -y -i "$temp_aiff" -ar 16000 -ac 1 -sample_fmt s16 "$output_path" 2>/dev/null

    rm -f "$temp_aiff"
}

echo "Generating speech clips for 88-key piano (A0 to C8)..."
echo "Voice: $VOICE"
echo ""

# Chord prefix
generate_clip "chord.wav" "chord"

# Octave 0: A, A#, B only (piano starts at A0)
echo "Octave 0:"
generate_clip "a0.wav" "note A 0"
generate_clip "a-sharp0.wav" "A sharp 0"
generate_clip "b0.wav" "B 0"

# Octaves 1-7: All 12 notes
for octave in 1 2 3 4 5 6 7; do
    echo "Octave $octave:"
    generate_clip "c${octave}.wav" "C $octave"
    generate_clip "c-sharp${octave}.wav" "C sharp $octave"
    generate_clip "d${octave}.wav" "D $octave"
    generate_clip "d-sharp${octave}.wav" "D sharp $octave"
    generate_clip "e${octave}.wav" "E $octave"
    generate_clip "f${octave}.wav" "F $octave"
    generate_clip "f-sharp${octave}.wav" "F sharp $octave"
    generate_clip "g${octave}.wav" "G $octave"
    generate_clip "g-sharp${octave}.wav" "G sharp $octave"
    generate_clip "a${octave}.wav" "note A $octave"
    generate_clip "a-sharp${octave}.wav" "A sharp $octave"
    generate_clip "b${octave}.wav" "B $octave"
done

# Octave 8: C only (piano ends at C8)
echo "Octave 8:"
generate_clip "c8.wav" "C 8"

echo ""
echo "Done! Generated clips in $OUTPUT_DIR"
echo "Total files: $(ls -1 $OUTPUT_DIR/*.wav 2>/dev/null | wc -l)"
