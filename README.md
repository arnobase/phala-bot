# Phabot

Phabot is nodejs script to help you automatically compound interest of a Phala mining pool 

!!! It needs your seeds to be available to claim, stake and restart the worker !!!
be aware that your seeds have to be stored into the local configuration file for the script to work properly

It is distributed without any guarantee, use it at your own risk
This version works with one pool worker, and one staker account, it's not designed to work with multiple staking account or pool worker

## Installation

Clone Git repo to get the library
Use npm to install Phabot.

```bash
git clone https://github.com/arnobase/phala-bot
cd phala-bot
npm install
```

## Configure
cp -a config.js.template config.js
# edit the config.js file to use your data

## Usage

use absolute path or create a symlink or bash alias if you need
examples below just run in the script directory

```bash
./phabot.js
# check status of your pool and stake account

./phabot.js --claim (-c)
# claim pending rewards

./phabot.js --stake [amount] (-s)
# stake available amount (all non locked or frozen PHA, or amount if specified)

./phabot.js --restart (-r)
# restart the worker to change stake to the maximum amount available

./phabot.js --debug (-d)
# run any of the commands without actually sending the transaction
```

## Automatisation
To claim, restake, and restart in one single command line, you can use this snippet:
```bash
./phabot.js -c && ./phabot.js -s && ./phabot.js -r
# this will claim, then stake, then restart
# if a tx failed, the next command will not execute, as the script return exit(1) on a TransactionFailed status (eg, if there is nothing to claim)
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)