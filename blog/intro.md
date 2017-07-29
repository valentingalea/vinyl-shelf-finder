TODO: list all the parts + pic
TODO: formating
TODO: add all the necessary steps from the various guides, don't redirect to them

Setting up SD card
------------------
This proved way more difficult then expected

TODO: show what USB SD card adaptor I'm using

Windows

First I tried setting everything on Windows.
I was thinking that the Linux subsystem would do the trick.
* I enabled 'Developer Mode'
* I installed it from 'Turn Windows features on and off'

Right form the start a big problem: USB devices are not able to be mounted: https://superuser.com/questions/1109993/accessing-removable-media-in-bash-on-windows
Apparently Windows Insider versions can do it, but for me that program is unavailable.

I was thinking of setting up a Virtual Box but I gave up

Mac OS

I also have 13" MacBook Air; I was thinking things would be easier here.

Started off semi ok with being able to write the official image using the `dd` command following this guide: https://www.raspberrypi.org/documentation/installation/installing-images/mac.md

Once this was done and I was thinking I would be able to read back the contents but no - same problem as in Windows: no native ext filesystem support.

According to Google searches there are 2 main options: https://www.google.co.uk/search?q=mac+os+read+linux+sd+card
* trying your luck with fuse-ext2 which you need to manually compile
* a commercial product from https://www.paragon-software.com/ufsdhome/extfs-mac/ 

I ended up using the Paragon thing - it comes with a 10 day trial. I will see what to do in the future. Just discovered this http://www.pibakery.org/index.html

Headless mode

I don't have any USB or HDMI adaptors for the PI so I am running it headless. There are various guides for this, the top one on Google is this: https://davidmaitland.me/2015/12/raspberry-pi-zero-headless-setup/

A stupid error

After I setup the Wifi & SSH according to the guide, I booted the PI, waited for a bit for the blinking light to stabilize and then.. nothing :( Couldn't connect, and the router web interface showed nothing. Tried some more pings and nmap's but still nothing

I took the SD card out, inserted it back into the Mac and reinspected the WPA WiFi config (after cross-checking) with other guides. Initially I used Mac's TextEdit to write the necessary files... and on closer inspection I noticed that the quotes characted looked too "curly" - the stupid app replaced the ASCII quote character with a fancier Unicode one! Some good old `vi` editing fixed them and I was finally able to ssh connect to the Pi!
