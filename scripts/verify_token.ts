// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
    await hre.run("verify:verify", {
        address: "0x6fbc77cBFC59D201DC03e004203734E0faE10D3E",
        constructorArguments: [
            ["0x98080C43486FfA945f7FA4A7d40B699Ff404798B"],
            ["525900000000000000000000"],
            155,
            "900000000000000000000000",
            "0x7b728FD84995fAC43A500Ae144A1e121916E5c07",
            "0xcf8834088b3b1e6D39938964a1d2A0c4BA7D4252",
            {
                p: "3333000000000000000000",
                aNumerator: 5,
                aDenominator: 10,
                bNumerator: 1,
                bDenominator: 730,
                c: 0,
                d: 0,
            },
            "Builder of PEOPLELAND",
            "BUILDER",
        ],
      });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
