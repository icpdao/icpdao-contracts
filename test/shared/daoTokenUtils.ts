import {
    FeeAmount,
    nearestUsableTick,
    Pool,
    Position,
    priceToClosestTick,
    TICK_SPACINGS,
    TickMath
} from "@uniswap/v3-sdk";
import {getMaxTick, getMinTick} from "./uniswapTicks";
import {CurrencyAmount, Price, Token} from "@uniswap/sdk-core";
import {parseUnits} from "@ethersproject/units";
import JSBI from "jsbi";


export const getTickSpacings = (fee: number) => {
    if (fee == 500) {
        return TICK_SPACINGS[FeeAmount.LOW];
    }
    if (fee == 3000) {
        return TICK_SPACINGS[FeeAmount.MEDIUM];
    }
    if (fee == 10000) {
        return TICK_SPACINGS[FeeAmount.HIGH];
    }
}

export const getNearestTickLower = (tick: number, fee: number, tickSpacing: number) => {
    const bei = Math.floor((getMaxTick(tickSpacing) - tick) / tickSpacing);
    return getMaxTick(tickSpacing) - tickSpacing * bei;
}

export const getNearestTickUpper = (tick: number, fee: number, tickSpacing: number) => {
    const bei = Math.floor((tick - getMinTick(tickSpacing)) / tickSpacing);
    return getMinTick(tickSpacing) + tickSpacing * bei;
}

export const getCreatePoolAndPosition = (feeAmount: FeeAmount, baseTokenAddress: string, quoteTokenAddress: string, baseTokenDecimals: number, quoteTokenDecimals: number, radioTokenAddress: string, radioValue: string, independentTokenAddress: string, independentTokenValue: string) => {
    let baseToken = new Token(1, baseTokenAddress, baseTokenDecimals);
    let quoteToken = new Token(1, quoteTokenAddress, quoteTokenDecimals);
    let tokenA;
    let tokenB;
    let tokenAPased;
    let tokenBPased;
    let tokenAIsBaseToken;
    if (baseToken.sortsBefore(quoteToken)) {
        tokenA = baseToken
        tokenB = quoteToken
        tokenAIsBaseToken = true
    } else {
        tokenA = quoteToken
        tokenB = baseToken
        tokenAIsBaseToken = false
    }

    if (radioTokenAddress == tokenA.address) {
        tokenAPased = parseUnits(radioValue, quoteToken.decimals);
        tokenBPased = parseUnits("1", baseToken.decimals);
    } else {
        tokenAPased = parseUnits("1", quoteToken.decimals);
        tokenBPased = parseUnits(radioValue, baseToken.decimals);
    }

    const tokenACurrencyAmount = CurrencyAmount.fromRawAmount(tokenA, JSBI.BigInt(tokenAPased))
    const tokenBCurrencyAmount = CurrencyAmount.fromRawAmount(tokenB, JSBI.BigInt(tokenBPased))

    let price = new Price(
        tokenACurrencyAmount.currency,
        tokenBCurrencyAmount.currency,
        tokenACurrencyAmount.quotient,
        tokenBCurrencyAmount.quotient
    )
    if (!tokenAIsBaseToken) {
        price = price.invert()
    }

    const currentTick = priceToClosestTick(price);
    const currentSqrt = TickMath.getSqrtRatioAtTick(currentTick);

    const mockPool = new Pool(tokenA, tokenB, feeAmount, currentSqrt, JSBI.BigInt(0), currentTick, [])

    const tickLower = nearestUsableTick(TickMath.MIN_TICK, TICK_SPACINGS[feeAmount])
    const tickUpper = nearestUsableTick(TickMath.MAX_TICK, TICK_SPACINGS[feeAmount])

    let position: Position;
    if (independentTokenAddress == tokenA.address) {
        let independentTokenValuePased = parseUnits(independentTokenValue, tokenA.decimals);
        let independentTokenCurrencyAmount = CurrencyAmount.fromRawAmount(tokenA, JSBI.BigInt(independentTokenValuePased))

        position = Position.fromAmount0({
            pool: mockPool,
            tickLower,
            tickUpper,
            amount0: independentTokenCurrencyAmount.quotient,
            useFullPrecision: true, // we want full precision for the theoretical position
        })
    } else {
        let independentTokenValuePased = parseUnits(independentTokenValue, tokenB.decimals);
        let independentTokenCurrencyAmount = CurrencyAmount.fromRawAmount(tokenB, JSBI.BigInt(independentTokenValuePased))

        position = Position.fromAmount1({
            pool: mockPool,
            tickLower,
            tickUpper,
            amount1: independentTokenCurrencyAmount.quotient
        })
    }

    return [mockPool, position];
}