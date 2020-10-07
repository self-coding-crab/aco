pragma solidity ^0.6.6;

import '../../util/Ownable.sol';
import '../../libs/Address.sol';
import '../../libs/ACOAssetHelper.sol';
import '../../interfaces/IController.sol';
import '../../interfaces/IControlled.sol';
import '../../interfaces/IACOVault.sol';
import '../../interfaces/IStrategy.sol';


contract Controller is Ownable, IController {
    using Address for address;
    
    event SetVault(address indexed newVault, address indexed newStrategy);
    event ChangeStrategy(address indexed vault, address indexed oldStrategy, address indexed newStrategy);
    event SetFeeDestination(address indexed oldFeeDestination, address indexed newFeeDestination);

    address public feeDestination;

    mapping(address => address) public vaults;
    mapping(address => address) public strategies;

    constructor(address _feeDestination) public {
        super.init();
        _setFeeDestination(_feeDestination);
    }
    
    function setVault(address newVault, address newStrategy) onlyOwner public {
        require(newVault.isContract(), "Controller:: Invalid vault");
        require(vaults[newVault] == address(0), "Controller:: Vault already exists");
        require(newStrategy.isContract(), "Controller:: Invalid strategy");
        require(strategies[newStrategy] == address(0), "Controller:: Strategy already exists");
        require(IACOVault(newVault).token() == IStrategy(newStrategy).token(), "Controller:: Asset does not match");
        
        emit SetVault(newVault, newStrategy);
        
        vaults[newVault] = newStrategy;
        strategies[newStrategy] = newVault;
    }
    
    function changeStrategy(address vault, address newStrategy) onlyOwner public {
        address oldStrategy = vaults[vault];
        require(oldStrategy != address(0), "Controller:: Invalid vault");
        require(newStrategy.isContract(), "Controller:: Invalid strategy");
        require(strategies[newStrategy] == address(0), "Controller:: Strategy already exists");
        address token = IACOVault(vault).token();
        require(token == IStrategy(newStrategy).token(), "Controller:: Asset does not match");
        
        IStrategy(oldStrategy).withdrawAll();
        
        emit ChangeStrategy(vault, vaults[vault], newStrategy);
        
        vaults[vault] = newStrategy;
        
        uint256 amount = IStrategy(oldStrategy).balanceOf();
        if (amount > 0) {
            ACOAssetHelper._callTransferFromERC20(token, oldStrategy, vault, amount);
        }
    }
    
    function setFeeDestination(address newFeeDestination) onlyOwner public {
        _setFeeDestination(newFeeDestination);
    }
    
    function withdrawStuckTokenOnControlled(address _contract, address token, address destination) onlyOwner public {
        IControlled(_contract).withdrawStuckToken(token, destination);
    }
    
    function sendFee(uint256 amount) public override {
        require(vaults[msg.sender] != address(0) || strategies[msg.sender] != address(0), "Controller:: Invalid sender");
        if (amount > 0) {
            ACOAssetHelper._callTransferFromERC20(IControlled(msg.sender).token(), msg.sender, feeDestination, amount);
        }
    }
    
    function balanceOf(address vault) public view override returns(uint256) {
        return IStrategy(vaults[vault]).balanceOf();
    }
    
    function actualAmount(address vault, uint256 amount) external view override returns(uint256) {
        return IStrategy(vaults[vault]).actualBalanceFor(amount);
    }
    
    function buyAco(address vault, uint256 acoAmount, uint256 assetAmount) external {
        require(vaults[vault] != address(0), "Controller:: Invalid vault");
        IACOVault _vault = IACOVault(vault);
        ACOAssetHelper._callTransferFromERC20(_vault.token(), vaults[vault], vault, assetAmount);
        _vault.setReward(acoAmount, assetAmount);
    }
    
    function earn(uint256 amount) public override {
        require(vaults[msg.sender] != address(0), "Controller:: Invalid sender");
        IStrategy strategy = IStrategy(vaults[msg.sender]);
        ACOAssetHelper._callTransferFromERC20(strategy.token(), msg.sender, address(strategy), amount);
        strategy.deposit(amount);
    }
    
    function withdraw(uint256 amount) public override returns(uint256) {
        require(vaults[msg.sender] != address(0), "Controller:: Invalid sender");
        IStrategy strategy = IStrategy(vaults[msg.sender]);
        uint256 _withdraw = strategy.withdraw(amount);
        ACOAssetHelper._callTransferFromERC20(strategy.token(), address(strategy), msg.sender, _withdraw);
        return _withdraw;
    }
    
    function _setFeeDestination(address newFeeDestination) internal {
        require(newFeeDestination != address(0), "Controller:: Invalid fee destination");
        emit SetFeeDestination(feeDestination, newFeeDestination);
        feeDestination = newFeeDestination;
    }
}