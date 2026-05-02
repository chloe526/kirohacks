#!/usr/bin/env python3

import speech_recognition as sr
import server
import datetime

def on_detect():
    """
    Updates state accordingly and starts the video call code.
    """

    time = datetime.datetime.now().isoformat()

    server.state["status"] = "HELP_TRIGGERED"
    server.state["help_event"]["triggered"] = time

    print(f"Triggered help event at: {time}")
    

def needs_help(msg: str):
    """
    Classify a transcript into whether or not a patient needs help.
    """

    return "help help" in msg


def set_patient_info():
    server.state["patient_id"] = "pat-0001"
    server.state["name"] = "John Doe"
    server.state["address"]["line1"] = "1234 Imaginary Ave"
    server.state["address"]["line2"] = "City State 12345"
    server.state["last_update"] = datetime.datetime.now().isoformat()


def main():
    set_patient_info()
    server.start_server()
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
                on_detect()
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
        while True:
            pass
    except KeyboardInterrupt:
        print("\nStopping...")
        stop_listening(wait_for_stop=False)


if __name__ == "__main__":
    main()
