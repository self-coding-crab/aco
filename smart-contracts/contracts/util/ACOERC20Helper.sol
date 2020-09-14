pragma solidity ^0.6.6;

/**
 * @title ACOERC20Helper
 * @dev A helper contract to handle with Ether and ERC20 tokens.
 */
contract ACOERC20Helper {
    
    /**
     * @dev Internal function to get if the address is for Ethereum (0x0).
     * @param _address Address to be checked.
     * @return Whether the address is for Ethereum.
     */ 
    function _isEther(address _address) internal pure returns(bool) {
        return _address == address(0);
    }
    
    /**
     * @dev Internal function to approve ERC20 tokens.
     * @param token Address of the token.
     * @param spender Authorized address.
     * @param amount Amount to authorize.
     */
    function _callApproveERC20(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory returndata) = token.call(abi.encodeWithSelector(0x095ea7b3, spender, amount));
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))), "ACOERC20Helper::_callApproveERC20");
    }
    
    /**
     * @dev Internal function to transfer ERC20 tokens.
     * @param token Address of the token.
     * @param recipient Address of the transfer destination.
     * @param amount Amount to transfer.
     */
    function _callTransferERC20(address token, address recipient, uint256 amount) internal {
        (bool success, bytes memory returndata) = token.call(abi.encodeWithSelector(0xa9059cbb, recipient, amount));
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))), "ACOERC20Helper::_callTransferERC20");
    }
    
    /**
     * @dev Internal function to call transferFrom on ERC20 tokens.
     * @param token Address of the token.
     * @param sender Address of the sender.
     * @param recipient Address of the transfer destination.
     * @param amount Amount to transfer.
     */
     function _callTransferFromERC20(address token, address sender, address recipient, uint256 amount) internal {
        (bool success, bytes memory returndata) = token.call(abi.encodeWithSelector(0x23b872dd, sender, recipient, amount));
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))), "ACOERC20Helper::_callTransferFromERC20");
    }
    
    /**
     * @dev Internal function to the asset symbol.
     * @param asset Address of the asset.
     * @return The asset symbol.
     */
    function _getAssetSymbol(address asset) internal view returns(string memory) {
        if (_isEther(asset)) {
            return "ETH";
        } else {
            (bool success, bytes memory returndata) = asset.staticcall(abi.encodeWithSelector(0x95d89b41));
            require(success, "ACOERC20Helper::_getAssetSymbol");
            return abi.decode(returndata, (string));
        }
    }
    
    /**
     * @dev Internal function to the asset decimals.
     * @param asset Address of the asset.
     * @return The asset decimals.
     */
    function _getAssetDecimals(address asset) internal view returns(uint8) {
        if (_isEther(asset)) {
            return uint8(18);
        } else {
            (bool success, bytes memory returndata) = asset.staticcall(abi.encodeWithSelector(0x313ce567));
            require(success, "ACOERC20Helper::_getAssetDecimals");
            return abi.decode(returndata, (uint8));
        }
    }

    /**
     * @dev Internal function to the asset name.
     * @param asset Address of the asset.
     * @return The asset name.
     */
    function _getAssetName(address asset) internal view returns(string memory) {
        if (_isEther(asset)) {
            return "Ethereum";
        } else {
            (bool success, bytes memory returndata) = asset.staticcall(abi.encodeWithSelector(0x06fdde03));
            require(success, "ACOERC20Helper::_getAssetName");
            return abi.decode(returndata, (string));
        }
    }
    
    /**
     * @dev Internal function to the asset balance of an account.
     * @param asset Address of the asset.
     * @param account Address of the account.
     * @return The account balance.
     */
    function _getAssetBalanceOf(address asset, address account) internal view returns(uint256) {
        if (_isEther(asset)) {
            return account.balance;
        } else {
            (bool success, bytes memory returndata) = asset.staticcall(abi.encodeWithSelector(0x70a08231, account));
            require(success, "ACOERC20Helper::_getAssetBalanceOf");
            return abi.decode(returndata, (uint256));
        }
    }
    
    /**
     * @dev Internal function to the asset allowance between two addresses.
     * @param asset Address of the asset.
     * @param owner Address of the owner of the tokens.
     * @param spender Address of the spender authorized.
     * @return The owner allowance for the spender.
     */
    function _getAssetAllowance(address asset, address owner, address spender) internal view returns(uint256) {
        if (_isEther(asset)) {
            return 0;
        } else {
            (bool success, bytes memory returndata) = asset.staticcall(abi.encodeWithSelector(0xdd62ed3e, owner, spender));
            require(success, "ACOERC20Helper::_getAssetAllowance");
            return abi.decode(returndata, (uint256));
        }
    }
}