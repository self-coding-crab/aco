import { SignedOrder } from '@0x/connect';
import { assetDataUtils } from '@0x/order-utils';
import { OrderInfo } from '@0x/types';

import { UI_DECIMALS_DISPLAYED_PRICE_ETH } from '../common/constants';

import { tokenAmountInUnitsToBigNumber } from './tokens';
import { OrderBookItem, OrderSide, Token, UIOrder } from './types';

export const ordersToUIOrders = (orders: SignedOrder[], baseToken: Token, ordersInfo?: OrderInfo[], quoteToken?: Token): UIOrder[] => {
    if (ordersInfo && quoteToken) {
        return ordersToUIOrdersWithOrdersInfo(orders, ordersInfo, baseToken, quoteToken);
    } else {
        return ordersToUIOrdersWithoutOrderInfo(orders, baseToken);
    }
};

// The user does not have web3 and the order info could not be retrieved from the contract
const ordersToUIOrdersWithoutOrderInfo = (orders: SignedOrder[], baseToken: Token): UIOrder[] => {
    const baseTokenEncoded = assetDataUtils.encodeERC20AssetData(baseToken.address);

    return orders.map((order, i) => {
        const side = order.takerAssetData === baseTokenEncoded ? OrderSide.Buy : OrderSide.Sell;
        const size = side === OrderSide.Sell ? order.makerAssetAmount : order.takerAssetAmount;
        const filled = null;
        const status = null;
        const price =
            side === OrderSide.Sell
                ? order.takerAssetAmount.div(order.makerAssetAmount)
                : order.makerAssetAmount.div(order.takerAssetAmount);

        return {
            rawOrder: order,
            side,
            size,
            filled,
            price,
            status,
        };
    });
};

// The user has web3 and the order info could be retrieved from the contract
const ordersToUIOrdersWithOrdersInfo = (
    orders: SignedOrder[],
    ordersInfo: OrderInfo[],
    baseToken: Token,
    quoteToken: Token
): UIOrder[] => {
    if (ordersInfo.length !== orders.length) {
        throw new Error(
            `AssertionError: Orders info length does not match orders length: ${ordersInfo.length} !== ${
                orders.length
            }`,
        );
    }

    const selectedTokenEncoded = assetDataUtils.encodeERC20AssetData(baseToken.address);

    return orders.map((order, i) => {
        const orderInfo = ordersInfo[i];

        const side = order.takerAssetData === selectedTokenEncoded ? OrderSide.Buy : OrderSide.Sell;
        const isSell = side === OrderSide.Sell;
        const size = isSell ? order.makerAssetAmount : order.takerAssetAmount;

        const makerAssetAddress = assetDataUtils.decodeERC20AssetData(order.makerAssetData).tokenAddress;
        const makerAssetTokenDecimals = makerAssetAddress.toLowerCase() === baseToken.address.toLowerCase() ? baseToken.decimals : quoteToken.decimals;
        const makerAssetAmountInUnits = tokenAmountInUnitsToBigNumber(order.makerAssetAmount, makerAssetTokenDecimals);
        const takerAssetTokenDecimals = makerAssetAddress.toLowerCase() === baseToken.address.toLowerCase() ? quoteToken.decimals : baseToken.decimals;
        const takerAssetAmountInUnits = tokenAmountInUnitsToBigNumber(order.takerAssetAmount, takerAssetTokenDecimals);

        const filled = isSell
            ? orderInfo.orderTakerAssetFilledAmount.div(order.takerAssetAmount).multipliedBy(order.makerAssetAmount)
            : orderInfo.orderTakerAssetFilledAmount;
        const price = isSell
            ? takerAssetAmountInUnits.div(makerAssetAmountInUnits)
            : makerAssetAmountInUnits.div(takerAssetAmountInUnits);
        const status = orderInfo.orderStatus;

        return {
            rawOrder: order,
            side,
            size,
            filled,
            price,
            status,
        };
    });
};

export const mergeByPrice = (orders: UIOrder[]): OrderBookItem[] => {
    const initialValue: { [x: string]: UIOrder[] } = {};
    const ordersByPrice = orders.reduce((acc, order) => {
        acc[order.price.toFixed(UI_DECIMALS_DISPLAYED_PRICE_ETH)] =
            acc[order.price.toFixed(UI_DECIMALS_DISPLAYED_PRICE_ETH)] || [];
        acc[order.price.toFixed(UI_DECIMALS_DISPLAYED_PRICE_ETH)].push(order);
        return acc;
    }, initialValue);

    // Returns an array of OrderBookItem
    return Object.keys(ordersByPrice)
        .map(price => {
            return ordersByPrice[price].reduce((acc, order) => {
                return {
                    ...acc,
                    size: acc.size.plus(order.size),
                };
            });
        })
        .map(order => {
            let newSize = order.size;
            if (order.filled) {
                newSize = order.size.minus(order.filled);
            }

            return {
                side: order.side,
                price: order.price,
                size: newSize,
            };
        });
};
