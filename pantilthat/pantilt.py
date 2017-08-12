#!/usr/bin/env python

import pantilthat
import time
import sys

def tick():
	time.sleep(0.015)

# sanity checks
if len(sys.argv) != 3:
	print "Usage: <pan> <tilt> in degrees\n"
	exit()

# read last cmd
orig_pan = pantilthat.get_pan()
orig_tilt = pantilthat.get_tilt()
print "found pan: %i; tilt: %i" % (orig_pan, orig_tilt)

# get args
new_pan = int(sys.argv[1])
new_tilt = int(sys.argv[2])
print "setting pan: %i; tilt: %i" % (new_pan, new_tilt)

# start laser
pantilthat.light_mode(pantilthat.PWM)
pantilthat.brightness(128)

# do the requests
pan = orig_pan
pan_incr = 1 if new_pan > orig_pan else -1
while pan != new_pan:
	pan = pan + pan_incr
	#print pan
	pantilthat.pan(pan)
	tick()

tilt = orig_tilt
tilt_incr = 1 if new_tilt > orig_tilt else -1
while tilt != new_tilt:
	tilt = tilt + tilt_incr
	#print tilt
	pantilthat.tilt(tilt)
	tick()

# sec; to allow the servos to move before they are auto shut down on exit
print "waiting:"
for t in range(0, 3): 
	time.sleep(1)
	print "."

# turn off the laser on the way out
#pantilthat.brightness(0)
