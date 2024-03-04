import { BigNumber } from "bignumber.js";
import { RoutingResultType, SwapResponse } from "rango-sdk-basic";

export const swapToString = (swap: SwapResponse, amount: string): string => {
    if (swap?.resultType !== RoutingResultType.OK || !swap?.tx)
        return swap.error || JSON.stringify(swap)
    const output = new BigNumber(swap.route.outputAmount).shiftedBy(-swap.route.to.decimals).toString()
    return `${amount} ${swap.route.from.symbol} -> 
              ${swap.route.swapper.title} ->
              ${output} ${swap.route.to.symbol} (${swap.route.outputAmountUsd}$)`
}
