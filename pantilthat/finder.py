#!/usr/bin/env python

import pantilthat
import time
import sys
import math
import servo_ranges

def tick():
	time.sleep(0.010)

class Shelf(object):
	def __init__(self):
		self.count = None; # num of records
		self.pan_start = None; # degress +
		self.pan_end = None; # degrees -
		self.tilt_pos = None; # degrees

	def map_pos_to_angles(self, pos):
		if (pos <= 0 or pos > self.count):
			return 0
		pan_range = abs(self.pan_start) + abs(self.pan_end)
		incr = float(pan_range) / self.count
		return int(self.pan_start - pos * incr)
		
		# dist = 700. #mm
		# record_thick = 10. #mm
		# error = .5 #mm
		# offset = (self.count / 2. - pos) * record_thick + error
		# print offset
		# angle = math.atan2(offset, dist)
		# return int(math.degrees(angle))

max_shelves = 5
shelves = [Shelf() for _ in range(max_shelves)]

shelves[0].count = 41
shelves[0].pan_start = 24
shelves[0].pan_end = -29
shelves[0].tilt_pos = -68

shelves[1].count = 68
shelves[1].pan_start = 24
shelves[1].pan_end = -28
shelves[1].tilt_pos = -40

shelves[2].count = 80
shelves[2].pan_start = 26
shelves[2].pan_end = -25
shelves[2].tilt_pos = 0

shelves[3].count = 88
shelves[3].pan_start = 25
shelves[3].pan_end = -26
shelves[3].tilt_pos = 40

shelves[4].count = 68
shelves[4].pan_start = 26
shelves[4].pan_end = -26
shelves[4].tilt_pos = 65

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
