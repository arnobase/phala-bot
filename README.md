# Phabot

![Phabot logo](img/phabot.png)

Phabot is a nodejs script that automatically compound interests of a staking account by claiming and restaking rewards, and can restart a Phala mining worker with the highest amount available

# Disclaimer
__The script require your seeds to be available to claim, stake and restart the worker. Be aware that your seeds have to be stored into the local configuration file for the script to work properly__

__As V2 support Proxy accounts, it's trongly advised to use it, read more about proxy here : https://wiki.polkadot.network/docs/learn-proxies__

>__storing the seed phrase on a machine connected to the Internet represents a significant security risk. Be sure to implement all the necessary means to secure your machine in order to protect yourself from viruses, hacking, or even theft of hardware.__

__It is distributed without any warantee. Under no circumstance shall I have any liability to you for any loss or damage of any kind incurred as a result of the use of this script. Your use is solely at your own risk.__

## V2.0
### new features :
- support of Proxy ![proxy](img/proxy.png) accounts  , see [Proxy Accounts](https://wiki.polkadot.network/docs/learn-proxies) on Polkadot wiki
- new command to claim pool owner rewards (`phabot -p`)
- error description from onchain metadata if tx fail
- verbose mode (for transactions details)
### improvements :
- check the amount before claiming and abort if nothing to claim (for staking account and pool owner rewards)
- misc display enhancements 
  - output ![colors](img/colors.png) (native on console output, use `less -R` to read logs)
  - better assets description
  - realtime transactions display
- rewrite of the config file
- added minimum amount to keep available on staking account

## V1.0
first realease, works with one pool worker, and one staker account, it's not designed to work with multiple staking account or pool worker, but could be easily adapted.

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
```
### example output: 
```
Pool 3106 status -------------------------------
             Maximum capacity:   20,001.0000 PHA
                 Total staked:   20,000.0000 PHA
              Stake available:        1.0000 PHA
           Pool owner rewards:       14.6289 PHA
             staked no worker:        0.0000 PHA

Staking account status -------------------------
43eaN9ye29zrKuDeCb6zBM71d4SQJNVqqUwtdEM3uvANaS2p
                Total balance:   21,191.4169 PHA
               Locked in pool:   20,000.0000 PHA
                 Free balance:    1,191.4169 PHA
              Pending Rewards:        0.0000 PHA
```

```bash
# claim pending rewards 
# will fail if thee is not any
phabot --claim (-c)

# claim pool owner rewards 
# will fail if there is not any
phabot --claimpool (-p)

# stake available amount (all non locked or frozen PHA, or other amount if specified)
phabot --stake [amount] (-s)

# restart the worker to change stake to the maximum amount available
phabot --restart (-r)

# run any of the commands without actually sending the transaction
phabot --debug (-d)

# chain claim, stake and restart in one command
phabot-batch
```

to use phabot-batch, add the symlink in /usr/bin

```
sudo ln -s `pwd`/phabot-batch.sh /usr/bin/phabot-batch
```

into `phabot-batch`, stake and restart commands are chained with `&&`
```bash
# phabot-batch.sh

# this will stake, then restart
phabot -s && phabot -r
```
this ensure that if a tx failed, the next command will not execute, as the script return exit(1) on a TransactionFailed status (eg, if there is nothing to stake) or a timeout (180s)

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