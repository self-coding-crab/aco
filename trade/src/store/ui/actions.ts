import { signatureUtils } from '@0x/order-utils';
import { MetamaskSubprovider } from '@0x/subproviders';
import { BigNumber } from '@0x/utils';
import { createAction } from 'typesafe-actions';

import { ZERO } from '../../common/constants';
import { InsufficientOrdersAmountException } from '../../exceptions/insufficient_orders_amount_exception';
import { InsufficientTokenBalanceException } from '../../exceptions/insufficient_token_balance_exception';
import { SignedOrderException } from '../../exceptions/signed_order_exception';
import { isWeth } from '../../util/known_tokens';
import { buildLimitOrder, buildMarketOrders } from '../../util/orders';
import {
    createBuySellLimitSteps,
    createBuySellMarketSteps,
} from '../../util/steps_modals_generation';
import {
    Notification,
    NotificationKind,
    OrderFeeData,
    OrderSide,
    Step,
    StepKind,
    StepToggleTokenLock,
    StepWrapEth,
    ThunkCreator,
    Token,
    TokenBalance,
    StoreState,
} from '../../util/types';
import * as selectors from '../selectors';
import { unitsInTokenAmount, tokenAmountInUnitsToBigNumber } from '../../util/tokens';

export const setHasUnreadNotifications = createAction('ui/UNREAD_NOTIFICATIONS_set', resolve => {
    return (hasUnreadNotifications: boolean) => resolve(hasUnreadNotifications);
});

export const addNotifications = createAction('ui/NOTIFICATIONS_add', resolve => {
    return (newNotifications: Notification[]) => resolve(newNotifications);
});

export const setNotifications = createAction('ui/NOTIFICATIONS_set', resolve => {
    return (notifications: Notification[]) => resolve(notifications);
});

export const setOrderPriceSelected = createAction('ui/ORDER_PRICE_SELECTED_set', resolve => {
    return (orderPriceSelected: BigNumber) => resolve(orderPriceSelected);
});

export const setStepsModalPendingSteps = createAction('ui/steps_modal/PENDING_STEPS_set', resolve => {
    return (pendingSteps: Step[]) => resolve(pendingSteps);
});

export const setStepsModalDoneSteps = createAction('ui/steps_modal/DONE_STEPS_set', resolve => {
    return (doneSteps: Step[]) => resolve(doneSteps);
});

export const setStepsModalCurrentStep = createAction('ui/steps_modal/CURRENT_STEP_set', resolve => {
    return (currentStep: Step | null) => resolve(currentStep);
});

export const stepsModalAdvanceStep = createAction('ui/steps_modal/advance_step');

export const stepsModalReset = createAction('ui/steps_modal/reset');

export const startToggleTokenLockSteps: ThunkCreator = (token: Token, isUnlocked: boolean) => {
    return async dispatch => {
        const toggleTokenLockStep = isUnlocked ? getLockTokenStep(token) : getUnlockTokenStep(token);

        dispatch(setStepsModalCurrentStep(toggleTokenLockStep));
        dispatch(setStepsModalPendingSteps([]));
        dispatch(setStepsModalDoneSteps([]));
    };
};

export const startWrapEtherSteps: ThunkCreator = (newWethBalance: BigNumber) => {
    return async (dispatch, getState) => {
        const state = getState();
        const currentWethBalance = selectors.getWethBalance(state);

        const wrapEthStep: StepWrapEth = {
            kind: StepKind.WrapEth,
            currentWethBalance,
            newWethBalance,
            context: 'standalone',
        };

        dispatch(setStepsModalCurrentStep(wrapEthStep));
        dispatch(setStepsModalPendingSteps([]));
        dispatch(setStepsModalDoneSteps([]));
    };
};

export const startBuySellLimitSteps: ThunkCreator = (
    amount: BigNumber,
    price: BigNumber,
    expirationTimeSeconds: BigNumber,
    side: OrderSide,
    orderFeeData: OrderFeeData,
) => {
    return async (dispatch, getState) => {
        const state = getState();
        const baseToken = selectors.getBaseToken(state) as Token;
        const quoteToken = selectors.getQuoteToken(state) as Token;
        const tokenBalances = selectors.getTokenBalances(state) as TokenBalance[];
        const wethTokenBalance = selectors.getWethTokenBalance(state) as TokenBalance;
        const ethBalance = selectors.getEthBalance(state);

        checkBalances(state, side, amount, price, baseToken, quoteToken);
        let [, buySellFlow, totalFilled] = getMarketSteps(side, state, amount, price, baseToken,quoteToken, tokenBalances, wethTokenBalance, ethBalance, orderFeeData, dispatch)

        if (totalFilled.isLessThan(amount)) {
            const remainingAmount = amount.minus(totalFilled)
            buySellFlow = buySellFlow.concat(createBuySellLimitSteps(
                baseToken,
                quoteToken,
                tokenBalances,
                wethTokenBalance,
                remainingAmount,
                price,
                expirationTimeSeconds,
                side,
                orderFeeData,
                totalFilled.isGreaterThan(0)
            ))
        }

        dispatch(setStepsModalCurrentStep(buySellFlow[0]));
        dispatch(setStepsModalPendingSteps(buySellFlow.slice(1)));
        dispatch(setStepsModalDoneSteps([]));
    };
};

export const startBuySellMarketSteps: ThunkCreator = (
    amount: BigNumber,
    side: OrderSide,
    orderFeeData: OrderFeeData,
    price?: BigNumber
) => {
    return async (dispatch, getState) => {
        const state = getState();        
        const baseToken = selectors.getBaseToken(state) as Token;
        const quoteToken = selectors.getQuoteToken(state) as Token;
        const tokenBalances = selectors.getTokenBalances(state) as TokenBalance[];
        const wethTokenBalance = selectors.getWethTokenBalance(state) as TokenBalance;
        const ethBalance = selectors.getEthBalance(state);

        const [, buySellMarketFlow] = getMarketSteps(side, state, amount, price, baseToken, quoteToken, tokenBalances, wethTokenBalance, ethBalance, orderFeeData, dispatch);
        dispatch(setStepsModalCurrentStep(buySellMarketFlow[0]));
        dispatch(setStepsModalPendingSteps(buySellMarketFlow.slice(1)));
        dispatch(setStepsModalDoneSteps([]));
    };
};

const checkBalances = (state: StoreState, side: OrderSide, amount: BigNumber, price: BigNumber, baseToken: Token, quoteToken:Token) => {    
    const quoteTokenBalance = selectors.getQuoteTokenBalance(state);
    const totalEthBalance = selectors.getTotalEthBalance(state);
    const baseTokenBalance = selectors.getBaseTokenBalance(state);
    
    if (side === OrderSide.Sell) {
        
        // When selling, user should have enough BASE Token
        if (baseTokenBalance && baseTokenBalance.balance.isLessThan(amount)) {
            throw new InsufficientTokenBalanceException(baseToken.symbol);
        }
    }
    else {
        var buyAmount = tokenAmountInUnitsToBigNumber(amount, baseToken.decimals)
        var totalAmount = buyAmount.times(price)
        var totalAmountDecimals = unitsInTokenAmount(totalAmount.toString(), quoteToken.decimals);
        // When buying and
        // if quote token is weth, should have enough ETH + WETH balance, or
        // if quote token is not weth, should have enough quote token balance
        const ifEthAndWethNotEnoughBalance = isWeth(quoteToken.symbol) && totalEthBalance.isLessThan(totalAmountDecimals);
        const ifOtherQuoteTokenAndNotEnoughBalance = !isWeth(quoteToken.symbol) &&
            quoteTokenBalance &&
            quoteTokenBalance.balance.isLessThan(totalAmountDecimals);
        if (ifEthAndWethNotEnoughBalance || ifOtherQuoteTokenAndNotEnoughBalance) {
            throw new InsufficientTokenBalanceException(quoteToken.symbol);
        }
    }
}


const getUnlockTokenStep = (token: Token): StepToggleTokenLock => {
    return {
        kind: StepKind.ToggleTokenLock,
        token,
        isUnlocked: false,
        context: 'standalone',
    };
};

const getLockTokenStep = (token: Token): StepToggleTokenLock => {
    return {
        kind: StepKind.ToggleTokenLock,
        token,
        isUnlocked: true,
        context: 'standalone',
    };
};

export const createSignedOrder: ThunkCreator = (
    amount: BigNumber, 
    price: BigNumber, 
    expirationTimeSeconds: BigNumber,
    side: OrderSide
    ) => {
    return async (dispatch, getState, { getContractWrappers, getWeb3Wrapper }) => {
        const state = getState();
        const ethAccount = selectors.getEthAccount(state);
        const baseToken = selectors.getBaseToken(state) as Token;
        const quoteToken = selectors.getQuoteToken(state) as Token;
        try {
            const web3Wrapper = await getWeb3Wrapper();
            const contractWrappers = await getContractWrappers();

            const order = await buildLimitOrder(
                {
                    account: ethAccount,
                    amount,
                    price,
                    expirationTimeSeconds,
                    baseTokenAddress: baseToken.address,
                    quoteTokenAddress: quoteToken.address,
                    exchangeAddress: contractWrappers.exchange.address,
                },
                side,
            );

            const provider = new MetamaskSubprovider(web3Wrapper.getProvider());
            return signatureUtils.ecSignOrderAsync(provider, order, ethAccount);
        } catch (error) {
            throw new SignedOrderException(error.message);
        }
    };
};

export const addMarketBuySellNotification: ThunkCreator = (
    id: string,
    amount: BigNumber,
    token: Token,
    side: OrderSide,
    tx: Promise<any>,
) => {
    return async dispatch => {
        dispatch(
            addNotifications([
                {
                    id,
                    kind: NotificationKind.Market,
                    amount,
                    token,
                    side,
                    tx,
                    timestamp: new Date(),
                },
            ]),
        );
    };
};

function getMarketSteps(side: OrderSide, state: StoreState, amount: BigNumber, price: BigNumber | undefined, baseToken: Token, quoteToken: Token, tokenBalances: TokenBalance[], wethTokenBalance: TokenBalance, ethBalance: BigNumber, orderFeeData: OrderFeeData, dispatch: any): [BigNumber, Step[], BigNumber] {
    const orders = side === OrderSide.Buy ? selectors.getOpenSellOrders(state) : selectors.getOpenBuyOrders(state);
    // tslint:disable-next-line:no-unused-variable
    const [, filledAmounts, canBeFilled, filledQuoteAmount] = buildMarketOrders({
        amount,
        orders,
    }, side, price);
    if (!canBeFilled && !price) {
        throw new InsufficientOrdersAmountException();
    }
    const totalFilledAmount = filledAmounts.reduce((total: BigNumber, currentValue: BigNumber) => {
        return total.plus(currentValue);
    }, ZERO);
    const avgPrice = totalFilledAmount.div(amount);
    checkBalances(state, side, amount, avgPrice, baseToken, quoteToken);
    let buySellMarketFlow: Step[] = []
    if (filledQuoteAmount.isGreaterThan(ZERO)) {   
        buySellMarketFlow = createBuySellMarketSteps(baseToken, quoteToken, tokenBalances, wethTokenBalance, ethBalance, filledQuoteAmount, side, avgPrice, orderFeeData, price);
    }
    return [totalFilledAmount, buySellMarketFlow, filledQuoteAmount]
}

