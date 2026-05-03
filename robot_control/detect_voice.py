#!/usr/bin/env python3

import glob
from sys import exit
import speech_recognition as sr

should_exit = False

def needs_help(msg: str):
    """
    Classify a transcript into whether or not a patient needs help.
    """

    return "help help" in msg


def main():
    recognizer = sr.Recognizer()

    # Tune VAD (voice activity detection) parameters to avoid sending
    # tiny or noise-only audio chunks that cause Google Bad Request errors.
    recognizer.energy_threshold = 200       # minimum RMS energy to count as speech
    recognizer.dynamic_energy_threshold = True  # auto-adjust to ambient noise
    recognizer.pause_threshold = 0.8        # seconds of silence that ends a phrase
    recognizer.phrase_threshold = 0.3       # minimum seconds of speaking to count
    recognizer.non_speaking_duration = 0.5  # seconds of silence kept at phrase edges

    mic = sr.Microphone(sample_rate=16000)  # 16 kHz is what Google expects

    print("Calibrating for ambient noise... please wait.")

    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=2)
    
    print(f"Energy threshold set to {recognizer.energy_threshold:.0f}")
    print("Ready. Speak into your microphone (Ctrl+C to stop).\n")

    def on_speech(recognizer, audio):
        # Skip clips that are too short — they reliably cause Bad Request
        duration = len(audio.frame_data) / (audio.sample_rate * audio.sample_width)
        
        if duration < 0.25:
            return

        try:
            text = recognizer.recognize_google(audio, language="en-US")

            print(f"heard: {text}")

            if needs_help(text):
                print("detected help request")
                global should_exit
                should_exit = True
        except sr.UnknownValueError:
            # Speech detected but unintelligible — not an error
            pass
        except sr.RequestError as e:
            print(f"[Speech service error: {e}]")

    # phrase_time_limit caps how long a single chunk can be (avoids huge uploads)
    stop_listening = recognizer.listen_in_background(
        mic, on_speech, phrase_time_limit=5
    )

    try:
        global should_exit
        while not should_exit:
            pass
    except KeyboardInterrupt:
        print("\nStopping...")
        stop_listening(wait_for_stop=False)
        exit(1)

if __name__ == "__main__":
    main()
