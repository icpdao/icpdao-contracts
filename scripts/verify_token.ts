// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
    await hre.run("verify:verify", {
        address: "0x31d51b5D8a477A138BB4001b52eaB0064cb706Ec",
        constructorArguments: [
            ["0x07dfB1959eE4c94Bc0704425a299941de0662c2a"],
            ["2000000000000000000000"],
            100,
            "20000000000000000000000",
            "0x865A1691DF940507792ca927916ee324E1B9CB2b",
            "0x9C292D2Ff25E8d00C0c082775102ADd0CD16645A",
            {
                p: "20000000000000000000",
                aNumerator: 5,
                aDenominator: 10,
                bNumerator: 1,
                bDenominator: 300,
                c: 0,
                d: 0,
            },
            "TF23",
            "TF23",
        ],
      });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
