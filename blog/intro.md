TODO: list all the parts + pic
TODO: formating

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
