date unknown
------------
web server: looked around various libs, angular vs react vs vue -- all too much
settled on Express js
nicely done demo with simple rooting

now trying to add the client side
so difficult just to get a search bar
tried a couple of codepen examples - all bad, they don't work once you take them out of there

the tribulation of JS and async

raspberry pi zero - nodejs is super old (UPDATE: i fixed that)

date unknown
------------
* the off center (covered in blog)
* was hard to pin down due to power of motors
* goes random at every boot
* trying to smooth drive, need the getters - the tilt one is fucked, returns same as pan
* solved with recompile of lib

26-27 august
------------
tried the RPIO lib for the pantilt
suxx completly - couldn't get any good version/branch/fork to work

found a new GPIO/pwm lib: http://abyz.co.uk/rpi/pigpio/python.html
way more low-level tho, couldn't do anythng need more time

trial & tribulations with the image cache: turns out the Pi chokes on the <img> clients request anyway, so the caching ideas was useless so I turned it off for now. Consider turning into a microservice that I can move to the main machine, or some express throthling...

27 august
---------
trying last.fm -- didn't work :( all repos are super old

having to upgrade nodejs on both main dev machine and pi - they are on 4.x, latest stable is 6.x (btw the Pi comes with 0.2!)
distributions are here: https://nodejs.org/dist/v6.11.2/
using guide from: https://blog.miniarray.com/installing-node-js-on-a-raspberry-pi-zero-21a1522db2bb
