#!/usr/bin/env python

import pantilthat
import time
import sys
import math
import servo_ranges

def tick():
	time.sleep(0.010)

class Shelf(object):
	def __init__(self, num, start, end, tilt):
		self.count = num; # num of records
		self.pan_start = start; # degress +
		self.pan_end = end; # degrees -
		self.tilt_pos = tilt; # degrees

	def map_pos_to_angles(self, pos):
		if (pos <= 0 or pos > self.count):
			return 0

	# naive algorithm: just lerp the range of angles
	# it works well enough
		pan_range = abs(self.pan_start) + abs(self.pan_end)
		incr = float(pan_range) / self.count
		return int(self.pan_start - pos * incr)
		
	# a better algoritm: get the angle based on physical
	# measurements - but somehow behaves very poorly
		# dist = 700. #mm
		# record_thick = 10. #mm
		# error = .5 #mm
		# offset = (self.count / 2. - pos) * record_thick + error
		# print offset
		# angle = math.atan2(offset, dist)
		# return int(math.degrees(angle))

max_shelves = 5
shelves = [
	Shelf(42, 24, -29, -68),
	Shelf(68, 24, -28, -40),
	Shelf(80, 26, -25,   0),
	Shelf(88, 25, -26, +40),
	Shelf(68, 26, -26, +65)
]

# sanity checks
if len(sys.argv) != 3:
	print "Usage: <shelf id> <shelf pos>\n"
	exit()

# setup
servo_ranges.calibrate()

# read last cmd
orig_pan = pantilthat.get_pan()
orig_tilt = pantilthat.get_tilt()
print "found pan: %i; tilt: %i" % (orig_pan, orig_tilt)

# get args
in_id = int(sys.argv[1])
in_id = (in_id - 1) % max_shelves # convert to C array notation
in_pos = int(sys.argv[2])
print "searching: %i %i" % (in_id, in_pos)

# find
new_pan = shelves[in_id].map_pos_to_angles(in_pos)
new_tilt = shelves[in_id].tilt_pos

# debug
print "output: %i %i" % (new_pan, new_tilt)
#exit()

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

# because the servos are so shit
# do a dance to hide the horrible inaccuracy
a = 0.
while a < (12 * math.pi):
	a += math.pi / 20.
	r = int(math.sin(a) * 5.)
	pantilthat.pan(new_pan + r)
	time.sleep(0.005)

# sec; to allow the servos to move before they are auto shut down on exit
print "waiting:"
for t in range(0, 3): 
	time.sleep(1)
	print "."

# turn off the laser on the way out
pantilthat.brightness(0)
