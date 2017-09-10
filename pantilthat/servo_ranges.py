import pantilthat

def calibrate():
    # pan
    pantilthat.servo_pulse_min(1, 1000)
    pantilthat.servo_pulse_max(1, 2000)

    # tilt
    pantilthat.servo_pulse_min(2, 1000)
    pantilthat.servo_pulse_max(2, 2250)