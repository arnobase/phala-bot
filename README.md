# Phabot

![Phabot logo](/phabot.png)

Phabot is a nodejs script that automatically compound interests of a staking account by claiming and restaking rewards, and can restart a Phala mining worker with the highest amount available

# Disclaimer
__The script require your seeds to be available to claim, stake and restart the worker. Be aware that your seeds have to be stored into the local configuration file for the script to work properly__

>__storing the seed phrase on a machine connected to the Internet represents a significant security risk. Be sure to implement all the necessary means to secure your machine in order to protect yourself from viruses, hacking, or even theft of hardware.__

__It is distributed without any warantee. Under no circumstance shall I have any liability to you for any loss or damage of any kind incurred as a result of the use of this script. Your use is solely at your own risk.__

## V1.0
This version works with one pool worker, and one staker account, it's not designed to work with multiple staking account or pool worker, but could be easily adapted.

## Installation

require git https://git-scm.com/downloads

require nodejs and npm, refer to https://nodejs.org/

```bash
# get the code
git clone https://github.com/arnobase/phala-bot
cd phala-bot
# install with npm
npm install
# add symlinks in /usr/bin
sudo ln -s `pwd`/phabot.js /usr/bin/phabot
sudo ln -s `pwd`/phabot-batch.sh /usr/bin/phabot-batch
```

## Configure
```bash
# copy the template 
cp config.js.template config.js
# edit the config.js file to use your own info
```

## Usage

```bash
# check status of your pool and stake account
phabot

# claim pending rewards 
# don't check if there is any, will fail if ther is not
phabot --claim (-c)

# stake available amount (all non locked or frozen PHA, or other amount if specified)
phabot --stake [amount] (-s)

# restart the worker to change stake to the maximum amount available
phabot --restart (-r)

# run any of the commands without actually sending the transaction
phabot --debug (-d)

# chain claim, stake and restart in one command
phabot-batch
```

into `phabot-batch`, commands are chained with `&&`
```bash
# phabot-batch.sh

# this will claim, then stake, then restart
phabot -c && phabot -s && phabot -r
```
this ensure that if a tx failed, the next command will not execute, as the script return exit(1) on a TransactionFailed status (eg, if there is nothing to claim) or a timeout (180s)

## Automatisation
To claim, restake, and restart in one single command line, you can use the snippet phabot-batch in a crontab

```bash
# will execute the batch everyday at 10am
# redirect the log to /path/to/logs/phabot.log
0 10 * * * /bin/bash -c "phabot-batch 2>&1 | tee -a /path/to/logs/phabot.log > /dev/null"
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)