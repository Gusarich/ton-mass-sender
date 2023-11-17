# ton-mass-sender
Summary
A bot that sends Toncoins to several addresses using smart contract

## Use case

Rewards for ton competitions
Payments for investors

The bot accepts JSON file that contains a dictionary from the address to the number of Toncoins to send to this address

JSON example
```json
{
    "EQDk0rRqwtKw34r0fecUO6YotwKfMPU9XIxwrfjOfX9BIUx_": "52",
    "EQBnk2PqeZZjIya2zvPlH2pnSQYYPjNReMntiOyWYt9au_fc": "34",
    "EQCafuKP6EVcOo_ZifdIBfE1EwM1QPFj_-ryaT0IY6CNRVtV": "100"
}
```
CSV example:
```sh
"EQDk0rRqwtKw34r0fecUO6YotwKfMPU9XIxwrfjOfX9BIUx_",52
"EQBnk2PqeZZjIya2zvPlH2pnSQYYPjNReMntiOyWYt9au_fc",34
"EQCafuKP6EVcOo_ZifdIBfE1EwM1QPFj_-ryaT0IY6CNRVtV",100
```
TG message example:
```c++
EQDk0rRqwtKw34r0fecUO6YotwKfMPU9XIxwrfjOfX9BIUx_: 52
EQBnk2PqeZZjIya2zvPlH2pnSQYYPjNReMntiOyWYt9au_fc: 34
EQCafuKP6EVcOo_ZifdIBfE1EwM1QPFj_-ryaT0IY6CNRVtV: 100
```
The user needs to connect to the bot via Ton Connect 2.0 with Tonkeeper.
Then they need to provide the file with the description of addresses and the number of tons to send to each address.
After that, they should approve transactions to send Toncoins from their wallet to the smart contract.
The smart contract will send the coins to addresses from the file.

Other details:

Smart contract recursively send all messages in chunks of length 254 if there are too many of them
Smart contract can be deployed with addresses and amounts in data
0.1 ton will be added for each address for gas. The remaining amount will be returned to the sender
Smart contract language: Func
Tests environment : blueprint & sandbox


