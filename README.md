# icpdao-contracts

### deploy test
```
yarn run hardhat run --network ropsten scripts/deploy_store.ts
yarn run hardhat run --network ropsten scripts/deploy_factory.ts
```

### etherscan verify
```
yarn run hardhat verify --network ropsten storeContractAddress "ownerAddress"
yarn run hardhat verify --network ropsten factoryContractAddress "ownerAddress" "storeContractAddress"
```