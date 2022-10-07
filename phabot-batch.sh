#!/bin/bash

# use this command in cron: 
# /bin/bash -c "/path/to/phabot/phabot-batch.sh 2>&1 | tee -a /path/to/logdir/phabot.log > /dev/null"

echo && echo "###############################################"
echo "$(date +'%F %T') ####### START BATCH #######"
echo "###############################################"
phabot -c && phabot -s && phabot -r
echo && echo "###############################################"
echo "$(date +'%F %T') #######  END BATCH  #######"
echo "###############################################"
