import os
import json_server as server
import datetime
import stream_server
import time


def set_patient_info():
    server.state["patient_id"] = "pat-0001"
    server.state["name"] = "John Doe"
    server.state["address"]["line1"] = "1234 Imaginary Ave"
    server.state["address"]["line2"] = "City State 12345"
    server.state["last_update"] = datetime.datetime.now().isoformat()


def main():
    set_patient_info()
    server.start_server()

    while True:
        server.state["status"] = "IDLE"
        server.state["last_update"] = datetime.datetime.now().isoformat()

        return_code = os.system("python3 detect_voice.py")

        if return_code == 0:
            # time.sleep(5)
            now = datetime.datetime.now().isoformat()
            server.state["help_event"]["triggered"] = now
            server.state["last_update"] = now

            server.state["status"] = "HELP_TRIGGERED"

            print(f"Triggered help event at: {now}")

            stream_server.main()            

            time.sleep(5)
        else:
            print("error in voice detection")
            exit(1)

if __name__ == "__main__":
    main()
