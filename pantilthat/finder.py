#!/usr/bin/env python

import pantilthat
import time
import sys

def tick():
	time.sleep(0.015)

class Shelf(object):
	def __init__(self):
		self.count = None; # num of records
		self.pan_range = None; # degress in total (+ and -)
		self.pan_correction = None; # degrees center pos
		self.tilt_pos = None; # degrees

	def map_pos_to_angles(self, pos):
		if (pos <= 0 or pos > self.count):
			return 0
		return int((self.count/2 - pos) / (self.count/self.pan_range) + self.pan_correction)

max_shelves = 5
shelves = [Shelf() for _ in range(max_shelves)]

shelves[0].count = 41
shelves[0].pan_range = 32
shelves[0].pan_correction = 6
shelves[0].tilt_pos = -30

shelves[1].count = 69
shelves[1].pan_range = 32
shelves[1].pan_correction = 6
shelves[1].tilt_pos = -8

shelves[2].count = 80
shelves[2].pan_range = 30
shelves[2].pan_correction = 6
shelves[2].tilt_pos = 20

shelves[3].count = 88
shelves[3].pan_range = 30
shelves[3].pan_correction = 7
shelves[3].tilt_pos = 50

shelves[4].count = 68
shelves[4].pan_range = 30
shelves[4].pan_correction = 6
shelves[4].tilt_pos = 70

# sanity checks
if len(sys.argv) != 3:
	print "Usage: <shelf id> <shelf pos>\n"
	exit()

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
#print vars(shelves[0])
#print "output: %i %i" % (new_pan, new_tilt)
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

# sec; to allow the servos to move before they are auto shut donw on exit
print "waiting:"
for t in range(0, 5): 
	time.sleep(1)
	print "."

# turn off the laser on the way out
pantilthat.brightness(0)
